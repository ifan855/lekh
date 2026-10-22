"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "@/lib/languages";
import { READER_FONTS } from "@/lib/fonts";
import { filePath } from "@lekh/core/files";

type Story = {
  id: string;
  title: string;
  description: string;
  language: string;
  visibility: "public" | "unlisted" | "private";
  status: "draft" | "published";
  tags: string[];
  fontPreset: string;
  coverKey: string | null;
  isCompleted: boolean;
};

export function StoryDetailsForm({ story }: { story: Story }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: story.title,
    description: story.description,
    language: story.language,
    visibility: story.visibility,
    status: story.status,
    tags: story.tags.join(", "),
    fontPreset: story.fontPreset,
    isCompleted: story.isCompleted,
  });
  const [coverKey, setCoverKey] = useState(story.coverKey);
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const save = async (overrides?: Partial<typeof form>) => {
    const next = { ...form, ...(overrides ?? {}) };
    setSaving(true);
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: next.title,
          description: next.description,
          language: next.language,
          visibility: next.visibility,
          status: next.status,
          tags: next.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 12),
          fontPreset: next.fontPreset,
          isCompleted: next.isCompleted,
          coverKey,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setForm(next);
      toast.success(next.status === "published" ? "Story published" : "Changes saved");
      router.refresh();
    } catch {
      toast.error("Could not save the story");
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (file: File) => {
    try {
      const presign = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bucket: "covers",
          name: file.name,
          contentType: file.type,
          folder: `stories/${story.id}`,
        }),
      });
      const { key, url } = (await presign.json()) as { key: string; url: string };
      await fetch(url, { method: "PUT", body: file, headers: { "content-type": file.type } });
      setCoverKey(key);
      toast.success("Cover uploaded — remember to save");
    } catch {
      toast.error("Upload failed");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this story and all of its chapters? This cannot be undone.")) return;
    const res = await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete the story");
      return;
    }
    toast.success("Story deleted");
    router.push("/write");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-[180px_1fr]">
        <div className="space-y-2">
          <Label>Cover</Label>
          <label className="flex aspect-[2/3] w-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed bg-muted/40 text-xs text-muted-foreground transition-colors hover:bg-muted">
            {coverKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={filePath("covers", coverKey) ?? ""} alt="Cover" className="h-full w-full object-cover" />
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                Add cover
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadCover(file);
              }}
            />
          </label>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(event) => update({ title: event.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={5}
              value={form.description}
              onChange={(event) => update({ description: event.target.value })}
              placeholder="Hook readers. What happens, and why should they care?"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={form.language} onValueChange={(value) => update({ language: value })}>
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

            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <Select
                value={form.visibility}
                onValueChange={(value) => update({ visibility: value as Story["visibility"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public — listed everywhere</SelectItem>
                  <SelectItem value="unlisted">Unlisted — link only</SelectItem>
                  <SelectItem value="private">Private — only you and co-authors</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Book font</Label>
              <Select value={form.fontPreset} onValueChange={(value) => update({ fontPreset: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {READER_FONTS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={form.tags}
                onChange={(event) => update({ tags: event.target.value })}
                placeholder="romance, slow burn, fae"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Completed</p>
              <p className="text-xs text-muted-foreground">Mark the story as finished.</p>
            </div>
            <Switch
              checked={form.isCompleted}
              onCheckedChange={(checked) => update({ isCompleted: checked })}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-5">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button
          variant={form.status === "published" ? "outline" : "default"}
          onClick={() => {
            void save({ status: form.status === "published" ? "draft" : "published" });
          }}
        >
          {form.status === "published" ? "Unpublish" : "Publish story"}
        </Button>
        <Button variant="ghost" className="ml-auto text-destructive" onClick={remove}>
          <Trash2 className="h-4 w-4" />
          Delete story
        </Button>
      </div>
    </div>
  );
}
