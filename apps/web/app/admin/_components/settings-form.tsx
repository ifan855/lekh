"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { adminRequest, reportError } from "@/app/admin/_lib/client";

export type SettingsPayload = {
  site: {
    name: string;
    tagline: string;
    announcement: string;
    announcementEnabled: boolean;
    defaultLanguage: string;
    languages: string[];
  };
  features: {
    ocr: boolean;
    realtime: boolean;
    comments: boolean;
    signupOpen: boolean;
  };
  moderation: {
    allowUnmoderatedUploads: boolean;
    blockedWords: string[];
  };
  vision: {
    provider: string;
    baseUrl: string;
    model: string;
    prompt: string;
    temperature: number;
    apiKeyConfigured: boolean;
  };
};

const LANGUAGES = [
  "en", "es", "fr", "de", "pt", "it", "nl", "pl", "uk", "ru", "tr", "ar", "fa", "ur", "hi",
  "bn", "ta", "te", "mr", "sw", "id", "vi", "th", "zh", "ja", "ko",
];

const PROVIDERS = [
  { value: "none", label: "Disabled" },
  { value: "openai", label: "OpenAI" },
  { value: "openai-compatible", label: "OpenAI-compatible" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Google Gemini" },
];

export function SettingsForm({ initial }: { initial: SettingsPayload }) {
  const [site, setSite] = useState(initial.site);
  const [features, setFeatures] = useState(initial.features);
  const [moderation, setModeration] = useState(initial.moderation);
  const [vision, setVision] = useState(initial.vision);
  const [apiKey, setApiKey] = useState("");
  const [blockedWords, setBlockedWords] = useState(initial.moderation.blockedWords.join("\n"));
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const save = async (section: "site" | "vision") => {
    setBusy(true);
    const body =
      section === "site"
        ? {
            site: {
              name: site.name,
              tagline: site.tagline,
              announcement: site.announcement,
              announcementEnabled: site.announcementEnabled,
              defaultLanguage: site.defaultLanguage,
              languages: site.languages,
            },
            features,
            moderation: {
              allowUnmoderatedUploads: moderation.allowUnmoderatedUploads,
              blockedWords: blockedWords
                .split("\n")
                .map((word) => word.trim().toLowerCase())
                .filter(Boolean),
            },
          }
        : {
            vision: {
              provider: vision.provider,
              baseUrl: vision.baseUrl,
              model: vision.model,
              prompt: vision.prompt,
              temperature: vision.temperature,
              ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            },
          };

    const result = await adminRequest("/api/admin/settings", "PATCH", body);
    setBusy(false);
    if (!result.ok) {
      reportError(result.error);
      return;
    }
    setApiKey("");
    toast.success(section === "site" ? "Site settings saved" : "Vision provider saved");
    startTransition(() => router.refresh());
  };

  const toggleLanguage = (code: string) => {
    setSite((prev) => ({
      ...prev,
      languages: prev.languages.includes(code)
        ? prev.languages.filter((value) => value !== code)
        : [...prev.languages, code],
    }));
  };

  return (
    <Tabs defaultValue="site">
      <TabsList className="w-full">
        <TabsTrigger value="site" className="flex-1">
          Site
        </TabsTrigger>
        <TabsTrigger value="vision" className="flex-1">
          Vision (image → text)
        </TabsTrigger>
      </TabsList>

      <TabsContent value="site" className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Identity</CardTitle>
            <CardDescription className="text-xs">Name, tagline and the announcement banner.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="site-name">Site name</Label>
              <Input
                id="site-name"
                value={site.name}
                onChange={(event) => setSite({ ...site, name: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="site-tagline">Tagline</Label>
              <Input
                id="site-tagline"
                value={site.tagline}
                onChange={(event) => setSite({ ...site, tagline: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="site-announcement">Announcement banner</Label>
              <Textarea
                id="site-announcement"
                value={site.announcement}
                onChange={(event) => setSite({ ...site, announcement: event.target.value })}
                placeholder="Shown at the top of the site while enabled."
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Announcement enabled</p>
                <p className="text-xs text-muted-foreground">Turn the banner on or off.</p>
              </div>
              <Switch
                checked={site.announcementEnabled}
                onCheckedChange={(checked) => setSite({ ...site, announcementEnabled: checked })}
                aria-label="Announcement enabled"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Languages</CardTitle>
            <CardDescription className="text-xs">
              The languages lekh offers, and the one used by default.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="default-language">Default language</Label>
              <Select
                value={site.defaultLanguage}
                onValueChange={(value) => setSite({ ...site, defaultLanguage: value })}
              >
                <SelectTrigger id="default-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Available languages</Label>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((code) => {
                  const active = site.languages.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleLanguage(code)}
                      aria-pressed={active}
                      className={
                        active
                          ? "rounded-full border border-transparent bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                          : "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                      }
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Features</CardTitle>
            <CardDescription className="text-xs">Switch parts of the product on or off.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(
              [
                ["ocr", "Image → text (OCR)"],
                ["realtime", "Realtime co-writing"],
                ["comments", "Comments"],
                ["signupOpen", "Sign-ups open"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm font-medium">{label}</p>
                <Switch
                  checked={features[key]}
                  onCheckedChange={(checked) => setFeatures({ ...features, [key]: checked })}
                  aria-label={label}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Moderation</CardTitle>
            <CardDescription className="text-xs">Upload policy and the blocked word list.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Allow unmoderated uploads</p>
                <p className="text-xs text-muted-foreground">
                  When off, new uploads wait for a moderator.
                </p>
              </div>
              <Switch
                checked={moderation.allowUnmoderatedUploads}
                onCheckedChange={(checked) =>
                  setModeration({ ...moderation, allowUnmoderatedUploads: checked })
                }
                aria-label="Allow unmoderated uploads"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="blocked-words">Blocked words</Label>
              <Textarea
                id="blocked-words"
                value={blockedWords}
                onChange={(event) => setBlockedWords(event.target.value)}
                placeholder="One word per line"
              />
            </div>
          </CardContent>
        </Card>

        <Button disabled={busy} onClick={() => void save("site")}>
          <Save />
          {busy ? "Saving…" : "Save site settings"}
        </Button>
      </TabsContent>

      <TabsContent value="vision" className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vision provider</CardTitle>
            <CardDescription className="text-xs">
              The provider that powers the image → text feature. Stored in the admin settings and
              used by the OCR pipeline at request time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="vision-provider">Provider</Label>
              <Select
                value={vision.provider}
                onValueChange={(value) => setVision({ ...vision, provider: value })}
              >
                <SelectTrigger id="vision-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="vision-base-url">Base URL</Label>
              <Input
                id="vision-base-url"
                value={vision.baseUrl}
                onChange={(event) => setVision({ ...vision, baseUrl: event.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="vision-api-key">API key</Label>
              <Input
                id="vision-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={vision.apiKeyConfigured ? "configured — type to replace" : "not set"}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {vision.apiKeyConfigured
                  ? "A key is stored. It is write-only: leave the field empty to keep it."
                  : "No key stored yet."}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="vision-model">Model</Label>
              <Input
                id="vision-model"
                value={vision.model}
                onChange={(event) => setVision({ ...vision, model: event.target.value })}
                placeholder="gpt-4o-mini"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="vision-prompt">Prompt</Label>
              <Textarea
                id="vision-prompt"
                value={vision.prompt}
                onChange={(event) => setVision({ ...vision, prompt: event.target.value })}
                placeholder="Instructions sent with every image."
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="vision-temperature">Temperature</Label>
              <Input
                id="vision-temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={vision.temperature}
                onChange={(event) =>
                  setVision({ ...vision, temperature: Number(event.target.value) })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Button disabled={busy} onClick={() => void save("vision")}>
          <Save />
          {busy ? "Saving…" : "Save vision provider"}
        </Button>
      </TabsContent>
    </Tabs>
  );
}
