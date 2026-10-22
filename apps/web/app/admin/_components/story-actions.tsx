"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { adminRequest, reportError } from "@/app/admin/_lib/client";

export function StoryActions({
  storyId,
  title,
  slug,
  status,
  visibility,
  featured,
}: {
  storyId: string;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  featured: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const published = status === "published";

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, message: string) => {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      reportError(result.error ?? "Something went wrong");
      return;
    }
    toast.success(message);
    startTransition(() => router.refresh());
  };

  const togglePublish = () =>
    run(
      () =>
        adminRequest(`/api/admin/stories/${storyId}/publish`, "POST", {
          status: published ? "draft" : "published",
        }),
      published ? "Story moved back to draft" : "Story published",
    );

  const toggleFeature = () =>
    run(
      () =>
        adminRequest(`/api/admin/stories/${storyId}/feature`, "POST", { featured: !featured }),
      featured ? "Story un-featured" : "Story featured",
    );

  const setVisibility = (next: string) =>
    run(
      () => adminRequest(`/api/admin/stories/${storyId}/visibility`, "POST", { visibility: next }),
      `Visibility set to ${next}`,
    );

  const remove = () =>
    run(async () => {
      const result = await adminRequest(`/api/admin/stories/${storyId}`, "DELETE");
      if (result.ok) setConfirmOpen(false);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }, "Story deleted");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void togglePublish()}>
        {published ? <EyeOff /> : <Eye />}
        {published ? "Unpublish" : "Publish"}
      </Button>

      <Button size="sm" variant={featured ? "default" : "outline"} disabled={busy} onClick={() => void toggleFeature()}>
        <Star />
        {featured ? "Featured" : "Feature"}
      </Button>

      <Select value={visibility} onValueChange={(value) => void setVisibility(value)} disabled={busy}>
        <SelectTrigger className="h-9 w-[8.5rem] text-xs" aria-label="Visibility">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="public">Public</SelectItem>
          <SelectItem value="unlisted">Unlisted</SelectItem>
          <SelectItem value="private">Private</SelectItem>
        </SelectContent>
      </Select>

      <Button asChild size="sm" variant="ghost">
        <Link href={`/story/${slug}`}>View</Link>
      </Button>

      <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmOpen(true)}>
        <Trash2 />
        Delete
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{title}”?</DialogTitle>
            <DialogDescription>
              The story, its chapters, parts, comments and read events are removed permanently.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
              {busy ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
