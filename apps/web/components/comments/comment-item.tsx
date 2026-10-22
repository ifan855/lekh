"use client";

import { useEffect, useState } from "react";
import { Flag, MessageSquare, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, timeAgo } from "@/lib/utils";

import { CommentComposer } from "./comment-composer";
import type { CommentAuthor, CommentDto, CommentViewer } from "./types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function avatarSrc(author: CommentAuthor | null): string | undefined {
  if (!author?.avatarKey) return undefined;
  return `/api/files/avatars/${encodeURIComponent(author.avatarKey)}`;
}

export function CommentAvatar({
  author,
  className,
}: {
  author: CommentAuthor | null;
  className?: string;
}) {
  const name = author?.displayName || author?.username || "Reader";
  return (
    <Avatar className={cn("h-9 w-9", className)}>
      <AvatarImage src={avatarSrc(author)} alt="" />
      <AvatarFallback aria-hidden>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

/** Re-render every minute so relative timestamps stay fresh. */
function useTicker(intervalMs = 60_000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

export type CommentItemProps = {
  comment: CommentDto;
  storyId: string;
  viewer: CommentViewer | null;
  /** 0 = top level, 1 = reply. */
  depth?: number;
  busyId?: string | null;
  onReply: (parent: CommentDto, body: string) => void | Promise<void>;
  onDelete: (comment: CommentDto) => void | Promise<void>;
  onReport: (comment: CommentDto) => void | Promise<void>;
};

export function CommentItem({
  comment,
  storyId,
  viewer,
  depth = 0,
  busyId = null,
  onReply,
  onDelete,
  onReport,
}: CommentItemProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  useTicker();

  const deleted = Boolean(comment.deletedAt);
  const isMine = Boolean(viewer && comment.author?.id === viewer.id);
  const isAdmin = viewer?.role === "admin";
  const busy = busyId === comment.id;
  const name = comment.author?.displayName || comment.author?.username || "Reader";

  return (
    <li className={cn("flex gap-3", depth > 0 && "mt-3 border-l-2 border-border pl-3")}>
      <CommentAvatar author={comment.author} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="text-xs text-muted-foreground" suppressHydrationWarning>
            {timeAgo(comment.createdAt)}
          </span>
        </div>

        {deleted ? (
          <p className="mt-1 text-sm italic text-muted-foreground">This comment was deleted.</p>
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            {comment.body}
          </p>
        )}

        {!deleted ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {depth === 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 px-3 text-muted-foreground"
                onClick={() => setReplyOpen((open) => !open)}
              >
                <MessageSquare />
                Reply
              </Button>
            ) : null}

            {isMine || isAdmin ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 px-3 text-muted-foreground"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Delete this comment?")) {
                    void onDelete(comment);
                  }
                }}
              >
                <Trash2 />
                Delete
              </Button>
            ) : null}

            {!isMine && viewer ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 px-3 text-muted-foreground"
                disabled={busy}
                onClick={() => void onReport(comment)}
              >
                <Flag />
                Report
              </Button>
            ) : null}
          </div>
        ) : null}

        {replyOpen ? (
          <div className="mt-2">
            <CommentComposer
              storyId={storyId}
              parentId={comment.id}
              compact
              autoFocus
              placeholder="Write a reply…"
              submitLabel="Reply"
              onCancel={() => setReplyOpen(false)}
              onSubmitted={async (body) => {
                await onReply(comment, body);
                setReplyOpen(false);
              }}
            />
          </div>
        ) : null}

        {comment.replies.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                storyId={storyId}
                viewer={viewer}
                depth={depth + 1}
                busyId={busyId}
                onReply={onReply}
                onDelete={onDelete}
                onReport={onReport}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

export default CommentItem;
