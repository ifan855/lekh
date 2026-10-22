"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { CommentThread } from "./comment-thread";
import { InlineCommentThread } from "./inline-comment-thread";
import {
  COMMENT_REQUEST_EVENT,
  COMMENTS_OPEN_EVENT,
  type CommentRequestDetail,
  type CommentsOpenDetail,
  type CommentScope,
} from "./types";

export type CommentsSheetProps = {
  /** Fallback used when an event does not carry a story id. */
  storyId?: string;
  /** Fallback used when an event does not carry a chapter id. */
  chapterId?: string | null;
  defaultScope?: CommentScope;
  className?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The reader dispatches its comment events without ids, so fall back to the
 * `/read/<storyId>/<chapterId>` URL when the host page did not pass them in.
 */
function inferIdsFromPath(): { storyId: string | null; chapterId: string | null } {
  if (typeof window === "undefined") return { storyId: null, chapterId: null };
  const segments = window.location.pathname.split("/").filter(Boolean);
  const uuids = segments.filter((segment) => UUID_RE.test(segment));
  if (uuids.length === 0) return { storyId: null, chapterId: null };
  return { storyId: uuids[0] ?? null, chapterId: uuids[1] ?? null };
}

type SheetState = {
  scope: CommentScope;
  storyId: string | null;
  chapterId: string | null;
  blockId: string | null;
  quotedText: string | null;
  prefill: string | null;
};

const EMPTY_STATE: SheetState = {
  scope: "story",
  storyId: null,
  chapterId: null,
  blockId: null,
  quotedText: null,
  prefill: null,
};

/**
 * Hosts a comment thread in a bottom sheet (phones) / side panel (desktop).
 *
 * The reader page opens it by dispatching a window CustomEvent:
 *   window.dispatchEvent(new CustomEvent("lekh:comments-open", {
 *     detail: { scope: "story" | "chapter" | "inline", storyId, chapterId?, blockId? },
 *   }));
 *   window.dispatchEvent(new CustomEvent("lekh:comment-request", {
 *     detail: { blockId, quote, storyId?, chapterId? },
 *   }));
 */
export function CommentsSheet({
  storyId,
  chapterId = null,
  defaultScope = "story",
  className,
}: CommentsSheetProps) {
  const [state, setState] = useState<SheetState>(EMPTY_STATE);
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(
    (event: Event) => {
      const detail = ((event as CustomEvent<CommentsOpenDetail>).detail ?? {}) as CommentsOpenDetail;
      const scope: CommentScope = detail.scope ?? defaultScope;
      const inferred = inferIdsFromPath();
      setState({
        scope,
        storyId: detail.storyId ?? storyId ?? inferred.storyId,
        chapterId: detail.chapterId ?? chapterId ?? inferred.chapterId,
        blockId: detail.blockId ?? null,
        quotedText: null,
        prefill: null,
      });
      setOpen(true);
    },
    [chapterId, defaultScope, storyId],
  );

  const handleRequest = useCallback(
    (event: Event) => {
      const detail = ((event as CustomEvent<CommentRequestDetail>).detail ??
        {}) as CommentRequestDetail;
      if (!detail.blockId) return;
      const quote = detail.quote ?? "";
      const inferred = inferIdsFromPath();
      setState({
        scope: "inline",
        storyId: detail.storyId ?? storyId ?? inferred.storyId,
        chapterId: detail.chapterId ?? chapterId ?? inferred.chapterId,
        blockId: detail.blockId,
        quotedText: quote || null,
        prefill: quote || null,
      });
      setOpen(true);
    },
    [chapterId, storyId],
  );

  useEffect(() => {
    window.addEventListener(COMMENTS_OPEN_EVENT, handleOpen);
    window.addEventListener(COMMENT_REQUEST_EVENT, handleRequest);
    return () => {
      window.removeEventListener(COMMENTS_OPEN_EVENT, handleOpen);
      window.removeEventListener(COMMENT_REQUEST_EVENT, handleRequest);
    };
  }, [handleOpen, handleRequest]);

  const activeStoryId = state.storyId ?? storyId ?? null;
  const activeChapterId = state.chapterId ?? chapterId ?? null;

  const title =
    state.scope === "inline"
      ? "Comments on this passage"
      : state.scope === "chapter"
        ? "Chapter discussion"
        : "Story discussion";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        className={cn(
          "left-auto right-0 top-auto bottom-0 h-[88dvh] gap-0 rounded-t-2xl p-0",
          "md:left-auto md:right-0 md:top-0 md:h-full md:max-w-md md:rounded-none md:border-l md:border-t-0",
          className,
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border md:hidden" />
          <SheetHeader className="shrink-0 space-y-0.5 border-b px-4 py-3">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="sr-only">Comments</SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 safe-bottom">
            {activeStoryId ? (
              state.scope === "inline" && state.blockId ? (
                <InlineCommentThread
                  storyId={activeStoryId}
                  chapterId={activeChapterId}
                  blockId={state.blockId}
                  quotedText={state.quotedText}
                  title={title}
                  composerInitialValue={state.prefill ?? ""}
                />
              ) : (
                <CommentThread
                  storyId={activeStoryId}
                  chapterId={activeChapterId}
                  scope={state.scope === "chapter" ? "chapter" : "story"}
                  title={title}
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                This reader is not connected to a story yet.
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default CommentsSheet;
