import { eq } from "drizzle-orm";

import { adminSettings, type AdminSettings } from "@lekh/db";

import { db } from "@lekh/db";

export const DEFAULT_SETTINGS: AdminSettings = {
  site: {
    name: "lekh",
    tagline: "Read. Write. Belong.",
    announcement: "",
    announcementEnabled: false,
    defaultLanguage: "en",
    languages: ["en", "es", "fr", "de", "pt", "it", "ar", "hi", "bn", "id", "ru", "zh", "ja", "ko", "tr", "fa", "ur", "ta", "te", "mr", "sw", "vi", "th", "nl", "pl", "uk"],
  },
  features: {
    ocr: true,
    realtime: true,
    comments: true,
    signupOpen: true,
  },
  vision: {
    provider: "none",
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    prompt:
      "Transcribe every piece of text visible in this image exactly as written. Preserve paragraph breaks. Do not add commentary. If a word is illegible, write [illegible].",
  },
  moderation: {
    allowUnmoderatedUploads: true,
    blockedWords: [],
  },
};

let cached: { value: AdminSettings; at: number } | null = null;

/** Read the admin settings blob (with sane defaults when unset). */
export async function getSettings(): Promise<AdminSettings> {
  if (cached && Date.now() - cached.at < 5_000) return cached.value;
  const rows = await db.select().from(adminSettings).where(eq(adminSettings.key, "site"));
  const raw = rows[0]?.value as Partial<AdminSettings> | undefined;
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(raw ?? {}),
    site: { ...DEFAULT_SETTINGS.site, ...(raw?.site ?? {}) },
    features: { ...DEFAULT_SETTINGS.features, ...(raw?.features ?? {}) },
    vision: { ...DEFAULT_SETTINGS.vision, ...(raw?.vision ?? {}) },
    moderation: { ...DEFAULT_SETTINGS.moderation, ...(raw?.moderation ?? {}) },
  } as AdminSettings;
  cached = { value: merged, at: Date.now() };
  return merged;
}

export async function setSettings(patch: Partial<AdminSettings>): Promise<AdminSettings> {
  const current = await getSettings();
  const next = {
    ...current,
    ...patch,
    site: { ...current.site, ...(patch.site ?? {}) },
    features: { ...current.features, ...(patch.features ?? {}) },
    vision: { ...current.vision, ...(patch.vision ?? {}) },
    moderation: { ...current.moderation, ...(patch.moderation ?? {}) },
  } as AdminSettings;
  await db
    .insert(adminSettings)
    .values({ key: "site", value: next })
    .onConflictDoUpdate({ target: adminSettings.key, set: { value: next, updatedAt: new Date() } });
  cached = { value: next, at: Date.now() };
  return next;
}

export function invalidateSettingsCache(): void {
  cached = null;
}
