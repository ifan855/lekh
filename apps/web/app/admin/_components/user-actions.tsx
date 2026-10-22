"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Shield, ShieldOff, Trash2 } from "lucide-react";

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

export function UserActions({
  userId,
  username,
  role,
  storyCount,
  isSelf,
}: {
  userId: string;
  username: string;
  role: string;
  storyCount: number;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const banned = role === "banned";
  const isAdmin = role === "admin";

  const setRole = async (nextRole: string) => {
    setBusy(true);
    const result = await adminRequest(`/api/admin/users/${userId}/role`, "POST", { role: nextRole });
    setBusy(false);
    if (!result.ok) {
      reportError(result.error);
      return;
    }
    toast.success(nextRole === "admin" ? `${username} is now an admin` : `${username} is no longer an admin`);
    startTransition(() => router.refresh());
  };

  const toggleBan = async () => {
    setBusy(true);
    const result = await adminRequest(`/api/admin/users/${userId}/ban`, "POST", { banned: !banned });
    setBusy(false);
    if (!result.ok) {
      reportError(result.error);
      return;
    }
    toast.success(banned ? `${username} was un-banned` : `${username} was banned`);
    startTransition(() => router.refresh());
  };

  const remove = async () => {
    setBusy(true);
    const result = await adminRequest(`/api/admin/users/${userId}`, "DELETE");
    setBusy(false);
    setConfirmOpen(false);
    if (!result.ok) {
      reportError(result.error);
      return;
    }
    toast.success(`${username} was deleted`);
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isSelf ? (
        <Badgeish label={isAdmin ? "admin (you)" : "you"} />
      ) : (
        <Select value={isAdmin ? "admin" : "user"} onValueChange={(value) => void setRole(value)} disabled={busy}>
          <SelectTrigger className="h-9 w-[7.5rem] text-xs" aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Button
        size="sm"
        variant={banned ? "outline" : "secondary"}
        disabled={busy || isSelf}
        onClick={() => void toggleBan()}
      >
        {banned ? <ShieldOff /> : <Shield />}
        {banned ? "Un-ban" : "Ban"}
      </Button>

      <Button asChild size="sm" variant="ghost">
        <Link href={`/admin/stories?author=${encodeURIComponent(userId)}`}>
          Stories ({storyCount})
        </Link>
      </Button>

      <Button
        size="sm"
        variant="destructive"
        disabled={busy || isSelf}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 />
        Delete
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete @{username}?</DialogTitle>
            <DialogDescription>
              This permanently removes the member and everything they wrote (stories, chapters,
              comments, follows). It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
              {busy ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Badgeish({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
      {label}
    </span>
  );
}
