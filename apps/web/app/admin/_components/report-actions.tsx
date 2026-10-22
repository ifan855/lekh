"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { adminRequest, reportError } from "@/app/admin/_lib/client";

export function ReportActions({
  reportId,
  commentId,
  storySlug,
  storyTitle,
}: {
  reportId: string;
  commentId: string;
  storySlug: string;
  storyTitle: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const resolve = () =>
    run(
      () => adminRequest(`/api/admin/reports/${reportId}/resolve`, "POST", { status: "resolved" }),
      "Report marked as resolved",
    );

  const dismiss = () =>
    run(
      () => adminRequest(`/api/admin/reports/${reportId}/resolve`, "POST", { status: "dismissed" }),
      "Report dismissed",
    );

  const deleteComment = () =>
    run(async () => {
      const result = await adminRequest(`/api/admin/comments/${commentId}/delete`, "POST");
      if (result.ok) setConfirmOpen(false);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }, "Comment deleted");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={busy} onClick={() => void resolve()}>
        <Check />
        Resolve
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void dismiss()}>
        <X />
        Dismiss
      </Button>
      <Button asChild size="sm" variant="ghost">
        <Link href={`/story/${storySlug}`}>Open story</Link>
      </Button>
      <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmOpen(true)}>
        <Trash2 />
        Delete comment
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this comment?</DialogTitle>
            <DialogDescription>
              The comment on “{storyTitle}” is removed for everyone. The moderation action is
              recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void deleteComment()}>
              {busy ? "Deleting…" : "Delete comment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
