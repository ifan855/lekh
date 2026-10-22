/**
 * Vision provider abstraction for the image -> text pipeline.
 *
 * The active provider is configured by an admin in the admin panel and stored
 * in `admin_settings`, so it can be swapped without a redeploy. Supported:
 *
 *  - `openai`            → OpenAI chat completions (vision)
 *  - `openai-compatible` → any OpenAI-compatible endpoint (OpenRouter, Groq, Ollama, LM Studio…)
 *  - `anthropic`         → Anthropic Messages API
 *  - `gemini`            → Google Gemini generateContent
 *  - `none`              → disabled
 */
import type { BlockNode } from "@lekh/db";

import { getSettings } from "./settings";

export type VisionProvider = "openai" | "openai-compatible" | "anthropic" | "gemini" | "none";

export type VisionConfig = {
  provider: VisionProvider;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  prompt?: string;
  temperature?: number;
};

export type TranscribeResult = {
  text: string;
  blocks: BlockNode[];
  confidence?: number;
  raw?: string;
};

export type ImagePayload = {
  base64: string;
  mimeType: string;
};

const DEFAULT_PROMPT = [
  "You are a precise transcription engine for scanned book pages and handwriting.",
  "Transcribe ALL visible text exactly as written, preserving paragraph breaks.",
  "Never summarise, never translate, never add notes.",
  "Use markdown headings (##) for headings and plain paragraphs for body text.",
  "If something is illegible, write [illegible].",
].join(" ");

export function visionConfigured(config?: VisionConfig): boolean {
  const cfg = config ?? (getSettings as unknown as never) as VisionConfig;
  return cfg.provider !== "none" && Boolean(cfg.apiKey || cfg.baseUrl);
}

function splitToBlocks(text: string): BlockNode[] {
  const lines = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const blocks: BlockNode[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        attrs: { level: Math.min(3, heading[1].length) as 1 | 2 | 3 },
        content: [{ type: "text", text: heading[2] }],
      });
      continue;
    }
    const inline = line
      .split(/\n/)
      .filter((l) => l.trim().length > 0)
      .map((l) => ({ type: "text" as const, text: l.trim() }));
    if (inline.length) blocks.push({ type: "paragraph", content: inline });
  }
  return blocks;
}

export function blocksToText(blocks: BlockNode[]): string {
  return blocks
    .map((b) => {
      const text = (b.content ?? []).map((n) => n.text).join("");
      if (b.type === "heading") return `## ${text}`;
      return text;
    })
    .join("\n\n");
}

function parseModelOutput(raw: string): { text: string; blocks: BlockNode[] } {
  const trimmed = raw.trim();
  // Models sometimes wrap JSON in a code fence.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    const parsed = JSON.parse(candidate) as {
      text?: string;
      blocks?: { type?: string; level?: number; text?: string; content?: string }[];
    };
    if (Array.isArray(parsed.blocks) && parsed.blocks.length) {
      const blocks: BlockNode[] = parsed.blocks.map((b) => {
        const text = b.text ?? b.content ?? "";
        if (b.type === "heading") {
          return {
            type: "heading",
            attrs: { level: (b.level ?? 2) as 1 | 2 | 3 },
            content: [{ type: "text", text }],
          };
        }
        return { type: "paragraph", content: [{ type: "text", text }] };
      });
      return { text: parsed.text ?? blocksToText(blocks), blocks };
    }
    if (typeof parsed.text === "string" && parsed.text) {
      return { text: parsed.text, blocks: splitToBlocks(parsed.text) };
    }
  } catch {
    /* fall through to plain text */
  }
  return { text: trimmed, blocks: splitToBlocks(trimmed) };
}

function jsonPrompt(base: string, extra?: string): string {
  const ask = [
    base,
    extra ?? "",
    'Respond with JSON only: {"blocks":[{"type":"paragraph"|"heading","level":1,"text":"..."}],"text":"full plain text"}',
  ]
    .filter(Boolean)
    .join("\n\n");
  return ask;
}

async function callOpenAiCompatible(
  cfg: VisionConfig,
  prompt: string,
  image: ImagePayload,
): Promise<string> {
  const base = (cfg.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: cfg.temperature ?? 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Vision provider error (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(cfg: VisionConfig, prompt: string, image: ImagePayload): Promise<string> {
  const base = (cfg.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 8000,
      temperature: cfg.temperature ?? 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mimeType, data: image.base64 } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Vision provider error (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (json.content ?? []).map((c) => c.text ?? "").join("");
}

async function callGemini(cfg: VisionConfig, prompt: string, image: ImagePayload): Promise<string> {
  const base = (cfg.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const url = `${base}/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const res = await fetch(`${url}${cfg.apiKey ? `?key=${cfg.apiKey}` : ""}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: image.mimeType, data: image.base64 } },
          ],
        },
      ],
      generationConfig: { temperature: cfg.temperature ?? 0 },
    }),
  });
  if (!res.ok) throw new Error(`Vision provider error (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

export async function callVision(
  prompt: string,
  image: ImagePayload,
  config?: VisionConfig,
): Promise<string> {
  const cfg = config ?? ((await getSettings()).vision ?? { provider: "none", model: "" });
  if (!cfg.provider || cfg.provider === "none") {
    throw new Error("No vision provider is configured. Ask an admin to configure one in the admin panel.");
  }
  switch (cfg.provider) {
    case "anthropic":
      return callAnthropic(cfg, prompt, image);
    case "gemini":
      return callGemini(cfg, prompt, image);
    case "openai":
    case "openai-compatible":
    default:
      return callOpenAiCompatible(cfg, prompt, image);
  }
}

/** Transcribe a single image into structured blocks. */
export async function transcribeImage(
  image: ImagePayload,
  options?: { language?: string; config?: VisionConfig },
): Promise<TranscribeResult> {
  const cfg = options?.config ?? (await getSettings()).vision!;
  const base = cfg.prompt || DEFAULT_PROMPT;
  const lang = options?.language && options.language !== "auto" ? `The text is in ${options.language}.` : "";
  const raw = await callVision(jsonPrompt(base, lang), image, cfg);
  const parsed = parseModelOutput(raw);
  return { text: parsed.text, blocks: parsed.blocks, raw };
}

/** Re-check a transcription against the image and propose corrections. */
export async function repairTranscription(
  image: ImagePayload,
  currentText: string,
  options?: { language?: string; config?: VisionConfig },
): Promise<TranscribeResult & { notes: string[] }> {
  const cfg = options?.config ?? (await getSettings()).vision!;
  const prompt = [
    "Compare the following draft transcription against the image.",
    "Fix every mistake: wrong characters, missing words, wrong order, broken paragraphs.",
    "Keep the author's wording and punctuation where it is already correct.",
    "Return the corrected full text plus a short list of what you changed.",
    "",
    "DRAFT TRANSCRIPTION:",
    currentText || "(empty)",
  ].join("\n");
  const raw = await callVision(prompt, image, cfg);
  const parsed = parseModelOutput(raw);
  const notes = raw
    .split("\n")
    .filter((l) => /^\s*[-*\d.]/.test(l))
    .map((l) => l.replace(/^\s*[-*\d.]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
  return { text: parsed.text, blocks: parsed.blocks, notes, raw };
}
