"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { createComment, deleteComment, fetchComments, reportComment } from "./api";
import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";
import type { CommentDto, CommentScope } from "./types";
import { useViewer } from "./use-viewer";

export type CommentListProps = {
  storyId: string;
  scope: CommentScope;
  chapterId?: string | null;
  blockId?: string | null;
  quotedText?: string | null;
  title?: string;
  emptyText?: string;
  /** Pre-fills the top-level composer (inline commenting on a quote). */
  composerInitialValue?: string;
  showComposer?: boolean;
  autoFocusComposer?: boolean;
  className?: string;
};

function appendTopLevel(comments: CommentDto[], created: CommentDto): CommentDto[] {
  return [...comments, { ...created, replies: created.replies ?? [] }];
}

function appendReply(comments: CommentDto[], created: CommentDto): CommentDto[] {
  const parentId = created.parentId;
  if (!parentId) return appendTopLevel(comments, created);
  return comments.map((comment) =>
    comment.id === parentId
      ? { ...comment, replies: [...comment.replies, { ...created, replies: [] }] }
      : comment,
  );
}

export function CommentList({
  storyId,
  scope,
  chapterId = null,
  blockId = null,
  quotedText = null,
  title,
  emptyText = "No comments yet. Be the first to say something.",
  composerInitialValue = "",
  showComposer = true,
  autoFocusComposer = false,
  className,
}: CommentListProps) {
  const { viewer } = useViewer();
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("storyId", storyId);
    params.set("scope", scope);
    if (scope === "chapter" && chapterId) params.set("chapterId", chapterId);
    if (scope === "inline") {
      if (chapterId) params.set("chapterId", chapterId);
      if (blockId) params.set("blockId", blockId);
    }
    return params.toString();
  }, [storyId, scope, chapterId, blockId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchComments({
        storyId,
        scope,
        chapterId: scope === "story" ? null : chapterId,
        blockId: scope === "inline" ? blockId : null,
      });
      setComments(data.comments);
      setTotal(data.total);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load comments");
    } finally {
      setLoading(false);
    }
  }, [storyId, scope, chapterId, blockId]);

  useEffect(() => {
    void load();
  }, [load, query]);

  async function handleCreate(body: string) {
    const result = await createComment({
      storyId,
      chapterId: scope === "story" ? null : chapterId,
      blockId: scope === "inline" ? blockId : null,
      quotedText: scope === "inline" ? quotedText : null,
      body,
    });
    setComments((current) => appendTopLevel(current, result.comment));
    setTotal((current) => current + 1);
  }

  async function handleReply(parent: CommentDto, body: string) {
    const result = await createComment({ storyId, parentId: parent.id, body });
    setComments((current) => appendReply(current, result.comment));
  }

  async function handleDelete(comment: CommentDto) {
    setBusyId(comment.id);
    try {
      await deleteComment(comment.id);
      setComments((current) =>
        current.map((item) =>
          item.id === comment.id
            ? { ...item, deletedAt: new Date().toISOString() }
            : {
                ...item,
                replies: item.replies.map((reply) =>
                  reply.id === comment.id
                    ? { ...reply, deletedAt: new Date().toISOString() }
                    : reply,
                ),
              },
        ),
      );
      setTotal((current) => Math.max(0, current - 1));
      toast.success("Comment deleted");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not delete comment");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReport(comment: CommentDto) {
    setBusyId(comment.id);
    try {
      await reportComment(comment.id);
      toast.success("Thanks — our moderators will take a look.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not report comment");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={cn("flex min-h-0 flex-col gap-4", className)} aria-label={title ?? "Comments"}>
      {title ? (
        <header className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">{total}</span>
        </header>
      ) : null}

      {showComposer ? (
        <CommentComposer
          storyId={storyId}
          chapterId={scope === "story" ? null : chapterId}
          blockId={scope === "inline" ? blockId : null}
          quotedText={scope === "inline" ? quotedText : null}
          initialValue={composerInitialValue}
          autoFocus={autoFocusComposer}
          placeholder={
            scope === "inline"
              ? "Add a comment on this passage…"
              : scope === "chapter"
                ? "Talk about this chapter…"
                : "Talk about this story…"
          }
          onSubmitted={handleCreate}
        />
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading comments…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3 h-9" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : null}

      {!loading && !error && comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : null}

      {comments.length > 0 ? (
        <ul className="space-y-5">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              storyId={storyId}
              viewer={viewer}
              busyId={busyId}
              onReply={handleReply}
              onDelete={handleDelete}
              onReport={handleReport}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default CommentList;
