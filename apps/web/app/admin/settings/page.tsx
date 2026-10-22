import { getSettings } from "@lekh/core";

import { EmailProviderCard } from "@/app/admin/_components/email-provider-card";
import { SettingsForm, type SettingsPayload } from "@/app/admin/_components/settings-form";
import { Forbidden } from "@/app/admin/_components/forbidden";
import { getAdminViewer } from "@/app/admin/_lib/server";

export const metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  const viewer = await getAdminViewer();
  if (!viewer) return <Forbidden />;

  const settings = await getSettings();
  const site = settings.site ?? {
    name: "lekh",
    tagline: "",
    announcement: "",
    announcementEnabled: false,
    defaultLanguage: "en",
    languages: ["en"],
  };
  const features = settings.features ?? {};
  const moderation = settings.moderation ?? {};
  const vision = settings.vision ?? { provider: "none" as const, model: "" };

  const payload: SettingsPayload = {
    site: {
      name: site.name,
      tagline: site.tagline,
      announcement: site.announcement ?? "",
      announcementEnabled: site.announcementEnabled ?? false,
      defaultLanguage: site.defaultLanguage ?? "en",
      languages: site.languages ?? ["en"],
    },
    features: {
      ocr: features.ocr ?? false,
      realtime: features.realtime ?? false,
      comments: features.comments ?? false,
      signupOpen: features.signupOpen ?? false,
    },
    moderation: {
      allowUnmoderatedUploads: moderation.allowUnmoderatedUploads ?? false,
      blockedWords: moderation.blockedWords ?? [],
    },
    vision: {
      provider: vision.provider,
      baseUrl: vision.baseUrl ?? "",
      model: vision.model ?? "",
      prompt: vision.prompt ?? "",
      temperature: vision.temperature ?? 0,
      apiKeyConfigured: Boolean(vision.apiKey),
    },
  };

  return (
    <div className="space-y-4">
      <SettingsForm initial={payload} />
      <EmailProviderCard />
      <p className="text-xs text-muted-foreground">
        Settings are stored in the <code>admin_settings</code> table and read on demand by the site.
        Changing them takes effect immediately — no redeploy needed.
      </p>
    </div>
  );
}
