"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, FileText, ImagePlus, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filePath } from "@lekh/core/files";

type Chapter = {
  id: string;
  title: string;
  position: number;
  partId: string | null;
  wordCount: number;
  thumbnailKey: string | null;
  updatedAt: string;
};

type Part = { id: string; title: string; position: number };

export function ChapterManager({
  storyId,
  initialChapters,
  initialParts,
}: {
  storyId: string;
  initialChapters: Chapter[];
  initialParts: Part[];
}) {
  const router = useRouter();
  const [chapters, setChapters] = useState(initialChapters);
  const [parts, setParts] = useState(initialParts);
  const [pending, startTransition] = useTransition();
  const [newPart, setNewPart] = useState("");

  const refresh = () => {
    router.refresh();
  };

  const addChapter = async (partId?: string | null) => {
    const res = await fetch(`/api/stories/${storyId}/chapters`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "", partId: partId ?? null }),
    });
    if (!res.ok) {
      toast.error("Could not create the chapter");
      return;
    }
    const data = (await res.json()) as { chapter: Chapter };
    setChapters((prev) => [...prev, { ...data.chapter, wordCount: 0, thumbnailKey: null }]);
    toast.success("Chapter added");
    refresh();
  };

  const renameChapter = async (id: string, title: string) => {
    setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    await fetch(`/api/chapters/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= chapters.length) return;
    const next = [...chapters];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setChapters(next.map((c, i) => ({ ...c, position: i })));
    startTransition(async () => {
      await Promise.all(
        next.map((c, i) =>
          fetch(`/api/chapters/${c.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ position: i }),
          }),
        ),
      );
      refresh();
    });
  };

  const assignPart = async (chapterId: string, partId: string) => {
    setChapters((prev) =>
      prev.map((c) => (c.id === chapterId ? { ...c, partId: partId === "none" ? null : partId } : c)),
    );
    await fetch(`/api/chapters/${chapterId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ partId: partId === "none" ? null : partId }),
    });
  };

  const removeChapter = async (id: string) => {
    const res = await fetch(`/api/chapters/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete the chapter");
      return;
    }
    setChapters((prev) => prev.filter((c) => c.id !== id));
    toast.success("Chapter deleted");
    refresh();
  };

  const uploadThumbnail = async (chapterId: string, file: File) => {
    try {
      const presign = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bucket: "thumbnails",
          name: file.name,
          contentType: file.type,
          folder: `stories/${storyId}`,
        }),
      });
      const { key, url } = (await presign.json()) as { key: string; url: string };
      await fetch(url, { method: "PUT", body: file, headers: { "content-type": file.type } });
      await fetch(`/api/chapters/${chapterId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thumbnailKey: key }),
      });
      setChapters((prev) => prev.map((c) => (c.id === chapterId ? { ...c, thumbnailKey: key } : c)));
      toast.success("Thumbnail added");
      refresh();
    } catch {
      toast.error("Upload failed");
    }
  };

  const addPart = async () => {
    if (!newPart.trim()) return;
    const res = await fetch(`/api/stories/${storyId}/parts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: newPart.trim() }),
    });
    if (!res.ok) {
      toast.error("Could not add the part");
      return;
    }
    const data = (await res.json()) as { part: Part };
    setParts((prev) => [...prev, data.part]);
    setNewPart("");
    refresh();
  };

  const grouped = parts.length
    ? parts.map((part) => ({
        part,
        chapters: chapters.filter((c) => c.partId === part.id),
      }))
    : [{ part: null as Part | null, chapters }];

  const orphans = parts.length ? chapters.filter((c) => !parts.some((p) => p.id === c.partId)) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => addChapter(null)}>
          <Plus className="h-4 w-4" />
          New chapter
        </Button>
        <div className="flex items-center gap-1.5">
          <Input
            value={newPart}
            onChange={(event) => setNewPart(event.target.value)}
            placeholder="New part name"
            className="h-9 w-40"
          />
          <Button variant="outline" size="sm" onClick={addPart}>
            Add part
          </Button>
        </div>
      </div>

      {grouped.map(({ part, chapters: group }) => (
        <section key={part?.id ?? "ungrouped"} className="space-y-2">
          {part && (
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {part.title || "Untitled part"}
              </h3>
              <Badge variant="muted">{group.length}</Badge>
              <Button
                variant="ghost"
                size="xs"
                className="ml-auto"
                onClick={() => addChapter(part.id)}
              >
                <Plus className="h-3 w-3" />
                Chapter
              </Button>
            </div>
          )}

          {group.length === 0 && (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              No chapters in this part yet.
            </p>
          )}

          <ul className="space-y-2">
            {group.map((chapter) => {
              const globalIndex = chapters.findIndex((c) => c.id === chapter.id);
              return (
                <li
                  key={chapter.id}
                  className="flex items-center gap-3 rounded-xl border bg-card p-2.5 shadow-sm"
                >
                  <span className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-[10px] text-muted-foreground">
                    {chapter.thumbnailKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={filePath("thumbnails", chapter.thumbnailKey) ?? ""}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <Input
                      value={chapter.title}
                      placeholder="Untitled chapter"
                      onChange={(event) => setChapters((prev) => prev.map((c) => (c.id === chapter.id ? { ...c, title: event.target.value } : c)))}
                      onBlur={(event) => renameChapter(chapter.id, event.target.value)}
                      className="h-8 border-transparent bg-transparent px-1 font-medium shadow-none focus-visible:border-input"
                    />
                    <p className="px-1 text-xs text-muted-foreground">
                      {chapter.wordCount.toLocaleString()} words
                    </p>
                  </div>

                  {parts.length > 0 && (
                    <Select value={chapter.partId ?? "none"} onValueChange={(value) => assignPart(chapter.id, value)}>
                      <SelectTrigger className="hidden h-8 w-32 text-xs sm:flex">
                        <SelectValue placeholder="No part" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No part</SelectItem>
                        {parts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title || "Untitled part"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move up"
                      disabled={globalIndex === 0 || pending}
                      onClick={() => move(globalIndex, -1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Move down"
                      disabled={globalIndex === chapters.length - 1 || pending}
                      onClick={() => move(globalIndex, 1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
                    <ImagePlus className="h-4 w-4" />
                    <span className="sr-only">Upload thumbnail</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadThumbnail(chapter.id, file);
                      }}
                    />
                  </label>

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete chapter"
                    onClick={() => removeChapter(chapter.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive/70" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {orphans.length > 0 && parts.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-serif text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Without a part
          </h3>
          <ul className="space-y-2">
            {orphans.map((chapter) => (
              <li key={chapter.id} className="rounded-lg border bg-card px-3 py-2 text-sm">
                {chapter.title || "Untitled chapter"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
