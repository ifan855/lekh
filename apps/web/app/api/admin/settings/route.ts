import { NextResponse } from "next/server";

import { getSettings, invalidateSettingsCache, setSettings } from "@lekh/core";
import type { AdminSettings } from "@lekh/db";
import { db } from "@lekh/db";
import { sql as drizzleSql } from "drizzle-orm";

import { jsonError, readJson, requireAdminApi, str, writeAudit } from "@/app/admin/_lib/server";

const PROVIDERS = ["openai", "anthropic", "gemini", "openai-compatible", "none"] as const;
type Provider = (typeof PROVIDERS)[number];

function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

/**
 * PATCH /api/admin/settings
 *
 * Body: a partial AdminSettings object. Nested sections are merged with the
 * stored value. `vision.apiKey` is write-only: when it is omitted or empty the
 * stored key is kept, so the panel can display "configured" without ever
 * round-tripping the secret through the browser.
 */
export async function PATCH(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;

  const body = await readJson(request);
  const patch: Partial<AdminSettings> = {};

  if (body.site && typeof body.site === "object") {
    const site = body.site as Record<string, unknown>;
    const next: NonNullable<AdminSettings["site"]> = {
      name: site.name as string,
      tagline: site.tagline as string,
    };
    if (typeof site.announcement === "string") next.announcement = site.announcement;
    const announcementEnabled = asBool(site.announcementEnabled);
    if (announcementEnabled !== undefined) next.announcementEnabled = announcementEnabled;
    if (typeof site.defaultLanguage === "string") next.defaultLanguage = site.defaultLanguage;
    const languages = asStringList(site.languages);
    if (languages) next.languages = languages;
    patch.site = next;
  }

  if (body.features && typeof body.features === "object") {
    const features = body.features as Record<string, unknown>;
    const next: NonNullable<AdminSettings["features"]> = {};
    for (const key of ["ocr", "realtime", "comments", "signupOpen"] as const) {
      const value = asBool(features[key]);
      if (value !== undefined) next[key] = value;
    }
    patch.features = next;
  }

  if (body.moderation && typeof body.moderation === "object") {
    const moderation = body.moderation as Record<string, unknown>;
    const next: NonNullable<AdminSettings["moderation"]> = {};
    const allow = asBool(moderation.allowUnmoderatedUploads);
    if (allow !== undefined) next.allowUnmoderatedUploads = allow;
    const blocked = asStringList(moderation.blockedWords);
    if (blocked) next.blockedWords = blocked;
    patch.moderation = next;
  }

  if (body.vision && typeof body.vision === "object") {
    const vision = body.vision as Record<string, unknown>;
    const current = (await getSettings()).vision ?? {
      provider: "none" as const,
      model: "",
    };
    const next: NonNullable<AdminSettings["vision"]> = {
      provider: current.provider,
      model: current.model,
    };

    const provider = str(vision.provider);
    if (provider) {
      if (!isProvider(provider)) return jsonError("unknown vision provider", 400);
      next.provider = provider;
    }
    const model = str(vision.model);
    if (model) next.model = model;

    const baseUrl = str(vision.baseUrl);
    if (baseUrl) next.baseUrl = baseUrl;

    const prompt = str(vision.prompt);
    if (prompt) next.prompt = prompt;

    const temperature = typeof vision.temperature === "number" ? vision.temperature : null;
    if (temperature !== null && Number.isFinite(temperature)) {
      next.temperature = Math.min(Math.max(temperature, 0), 2);
    }

    const apiKey = str(vision.apiKey);
    if (apiKey) next.apiKey = apiKey;
    else if (vision.clearApiKey === true) next.apiKey = "";

    patch.vision = next;
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("nothing to update", 400);
  }

  const saved = await setSettings(patch);
  invalidateSettingsCache();

  const changed = Object.keys(patch);
  await writeAudit({
    actorId: viewer.userId,
    action: "settings.update",
    targetType: "settings",
    targetId: "site",
    meta: { sections: changed, visionProvider: saved.vision?.provider ?? null },
  });

  return NextResponse.json({
    ok: true,
    settings: {
      ...saved,
      vision: saved.vision ? { ...saved.vision, apiKey: saved.vision.apiKey ? "configured" : undefined } : undefined,
    },
  });
}

/**
 * GET /api/admin/settings — returns the stored settings with the API key
 * redacted (the browser never receives the secret).
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const settings = await getSettings();
  return NextResponse.json({
    ok: true,
    settings: {
      ...settings,
      vision: settings.vision
        ? {
            ...settings.vision,
            apiKey: undefined,
            apiKeyConfigured: Boolean(settings.vision.apiKey),
          }
        : undefined,
    },
  });
}

/**
 * PUT /api/admin/settings — replace the whole settings blob (used by the
 * "reset to defaults" button).
 */
export async function PUT() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;

  const current = await getSettings();
  await db.execute(
    drizzleSql`delete from admin_settings where key = ${"site"}`,
  );
  const saved = await setSettings({});
  invalidateSettingsCache();
  await writeAudit({
    actorId: viewer.userId,
    action: "settings.reset",
    targetType: "settings",
    targetId: "site",
    meta: { previousProvider: current.vision?.provider ?? null },
  });
  return NextResponse.json({ ok: true, settings: saved });
}
