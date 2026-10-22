"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "@/lib/languages";
import { filePath } from "@lekh/core/files";

type Profile = {
  id: string;
  displayName: string;
  username: string;
  bio: string;
  avatarKey: string | null;
  language: string;
  email: string | null;
};

export function ProfileForm({ profile }: { profile: Profile }) {
  const [form, setForm] = useState({
    displayName: profile.displayName,
    username: profile.username,
    bio: profile.bio,
    language: profile.language,
  });
  const [avatarKey, setAvatarKey] = useState(profile.avatarKey);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, avatarKey }),
      });
      if (!res.ok) throw new Error("failed");
      toast.success("Profile updated");
    } catch {
      toast.error("Could not update your profile");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    try {
      const presign = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bucket: "avatars",
          name: file.name,
          contentType: file.type,
          folder: profile.id,
        }),
      });
      const { key, url } = (await presign.json()) as { key: string; url: string };
      await fetch(url, { method: "PUT", body: file, headers: { "content-type": file.type } });
      setAvatarKey(key);
      toast.success("Avatar uploaded — remember to save");
    } catch {
      toast.error("Upload failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed bg-muted/40 text-xs text-muted-foreground">
          {avatarKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={filePath("avatars", avatarKey) ?? ""} alt="" className="h-full w-full object-cover" />
          ) : (
            "Avatar"
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadAvatar(file);
            }}
          />
        </label>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="truncate text-sm font-medium">{profile.email ?? "unknown"}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          rows={3}
          value={form.bio}
          onChange={(event) => setForm({ ...form, bio: event.target.value })}
          placeholder="A line or two about you and what you write."
        />
      </div>

      <div className="space-y-1.5">
        <Label>Preferred language</Label>
        <Select value={form.language} onValueChange={(value) => setForm({ ...form, language: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </div>
  );
}
