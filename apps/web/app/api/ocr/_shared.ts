import "server-only";

import { NextResponse } from "next/server";

import {
  BUCKETS,
  createDownloadUrl,
  createUploadUrl,
  filePath,
  getSettings,
  objectKey,
} from "@lekh/core";
import type { VisionConfig } from "@lekh/core";
import { db, ocrJobs } from "@lekh/db";
import type { BlockNode, OcrImageResult } from "@lekh/db";
import { and, eq } from "drizzle-orm";

import { getViewer } from "@/lib/session";
import type { Viewer } from "@/lib/session";

import type { OcrJobView } from "@/components/ocr/types";

export type OcrJobRecord = typeof ocrJobs.$inferSelect;

export const OCR_MAX_IMAGES = 20;
export const OCR_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Uniform JSON error shape for every OCR route. */
export function jsonError(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: message, ...(extra ?? {}) }, { status });
}

/** Resolve the signed-in user, or return a 401 response. */
export async function requireOcrUser(): Promise<Viewer | NextResponse> {
  const viewer = await getViewer();
  if (!viewer) return jsonError("You need to be signed in to use image-to-text.", 401);
  return viewer;
}

/** Narrow a `Viewer | NextResponse` union. */
export function isResponse(value: Viewer | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export async function loadJob(id: string, userId: string): Promise<OcrJobRecord | null> {
  const rows = await db
    .select()
    .from(ocrJobs)
    .where(and(eq(ocrJobs.id, id), eq(ocrJobs.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Serialise a job row into the shape the client consumes. */
export function toJobView(job: OcrJobRecord): OcrJobView {
  return {
    id: job.id,
    status: job.status as OcrJobView["status"],
    provider: job.provider,
    model: job.model,
    language: job.language,
    storyId: job.storyId ?? null,
    chapterId: job.chapterId ?? null,
    images: job.images ?? [],
    results: job.results ?? [],
    error: job.error ?? null,
    createdAt: job.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: job.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

/** The image entry of a job (stored metadata). */
export function jobImage(job: OcrJobRecord, key: string) {
  return (job.images ?? []).find((img) => img.key === key) ?? null;
}

/** The per-image result of a job. */
export function jobResult(job: OcrJobRecord, key: string): OcrImageResult | null {
  return (job.results ?? []).find((r) => r.imageKey === key) ?? null;
}

/** Replace one result inside a job, keeping the rest untouched. */
export function withResult(
  results: OcrImageResult[],
  key: string,
  patch: Partial<OcrImageResult>,
): OcrImageResult[] {
  let found = false;
  const next = results.map((r) => {
    if (r.imageKey !== key) return r;
    found = true;
    return { ...r, ...patch };
  });
  if (!found) {
    next.push({ imageKey: key, status: "pending", ...patch });
  }
  return next;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
};

export function mimeTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "image/jpeg";
}

export function isImageContentType(contentType: string): boolean {
  return /^image\/[a-z0-9.+-]+$/i.test(contentType.trim());
}

/** Download a stored object and return it base64-encoded for the vision model. */
export async function fetchImageBase64(key: string): Promise<{ base64: string; mimeType: string }> {
  const url = await createDownloadUrl(BUCKETS.uploads, key);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not download the uploaded image (HTTP ${res.status}). Please re-upload it.`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error("The uploaded image is empty. Please re-upload it.");
  }
  return { base64: buffer.toString("base64"), mimeType: mimeTypeForKey(key) };
}

/** The admin-configured vision provider, or a friendly error. */
export async function visionConfigOrError(): Promise<
  { ok: true; config: VisionConfig } | { ok: false; message: string }
> {
  let settings: Awaited<ReturnType<typeof getSettings>>;
  try {
    settings = await getSettings();
  } catch {
    return {
      ok: false,
      message: "Could not read the server settings. Ask an admin to check the vision configuration.",
    };
  }
  const vision = settings.vision;
  if (!vision || !vision.provider || vision.provider === "none") {
    return {
      ok: false,
      message:
        "No vision provider is configured. Ask an admin to configure one in the admin panel, then try again.",
    };
  }
  if (!vision.apiKey && !vision.baseUrl) {
    return {
      ok: false,
      message:
        "The vision provider is missing its credentials. Ask an admin to finish configuring it in the admin panel, then try again.",
    };
  }
  return { ok: true, config: vision as VisionConfig };
}

/** Turn plain text (markdown-ish) into editor blocks. */
export function textToBlocks(text: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  const chunks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({
        type: "heading",
        attrs: { level: Math.min(3, heading[1].length) as 1 | 2 | 3 },
        content: [{ type: "text", text: heading[2].trim() }],
      });
      continue;
    }
    const content = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ type: "text" as const, text: line }));
    if (content.length) blocks.push({ type: "paragraph", content });
  }
  return blocks;
}

/** Normalise a language hint: empty / "auto" means "let the model decide". */
export function normaliseLanguage(language: unknown): string {
  if (typeof language !== "string") return "auto";
  const value = language.trim().toLowerCase();
  if (!value || value === "auto") return "auto";
  return value.slice(0, 32);
}

/** Sanitise a user supplied file name. */
export function sanitiseName(name: unknown): string {
  if (typeof name !== "string") return "image";
  const cleaned = name.replace(/[^\w.\- ]+/g, "-").trim();
  return (cleaned || "image").slice(0, 120);
}

/** Build the storage key + presigned upload url for one image. */
export async function prepareUpload(
  userId: string,
  name: string,
  contentType: string,
): Promise<{ key: string; name: string; contentType: string; url: string }> {
  const key = objectKey(`ocr/${userId}`, name);
  const { url } = await createUploadUrl(BUCKETS.uploads, key, contentType);
  return { key, name, contentType, url };
}

/** Public (browser reachable) url of a stored object. */
export function publicUrlForKey(key: string): string {
  return filePath(BUCKETS.uploads, key) ?? "";
}

