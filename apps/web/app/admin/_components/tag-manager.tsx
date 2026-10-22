"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Merge, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { adminRequest, reportError } from "@/app/admin/_lib/client";

export type TagRow = { tag: string; count: number };

export function TagManager({ tags }: { tags: TagRow[] }) {
  return (
    <div className="space-y-2">
      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tags in use yet.</p>
      ) : (
        tags.map((row) => <TagRowItem key={row.tag} row={row} all={tags} />)
      )}
    </div>
  );
}

function TagRowItem({ row, all }: { row: TagRow; all: TagRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(row.tag);
  const [mergeInto, setMergeInto] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const others = all.filter((item) => item.tag !== row.tag);

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

  const rename = () =>
    run(
      () => adminRequest("/api/admin/tags/rename", "POST", { from: row.tag, to: name }),
      `Renamed “${row.tag}”`,
    );

  const merge = () =>
    run(
      () => adminRequest("/api/admin/tags/merge", "POST", { from: row.tag, to: mergeInto }),
      `Merged “${row.tag}” into “${mergeInto}”`,
    );

  const remove = () =>
    run(async () => {
      const result = await adminRequest("/api/admin/tags/delete", "POST", { tag: row.tag });
      if (result.ok) setConfirmOpen(false);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }, `Deleted “${row.tag}”`);

  return (
    <div className="space-y-2 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">#{row.tag}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {row.count} {row.count === 1 ? "story" : "stories"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-9 w-full min-w-0 flex-1 text-sm"
          aria-label={`New name for ${row.tag}`}
        />
        <Button size="sm" variant="secondary" disabled={busy || !name || name === row.tag} onClick={() => void rename()}>
          <Pencil />
          Rename
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={mergeInto} onValueChange={setMergeInto} disabled={busy || others.length === 0}>
          <SelectTrigger className="h-9 w-full min-w-0 flex-1 text-xs" aria-label={`Merge ${row.tag} into`}>
            <SelectValue placeholder={others.length ? "Merge into…" : "No other tags"} />
          </SelectTrigger>
          <SelectContent>
            {others.map((other) => (
              <SelectItem key={other.tag} value={other.tag}>
                #{other.tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={busy || !mergeInto} onClick={() => void merge()}>
          <Merge />
          Merge
        </Button>
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmOpen(true)}>
          <Trash2 />
          Delete
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag “{row.tag}”?</DialogTitle>
            <DialogDescription>
              The tag is removed from {row.count} {row.count === 1 ? "story" : "stories"}. The
              stories themselves are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
              {busy ? "Deleting…" : "Delete tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
