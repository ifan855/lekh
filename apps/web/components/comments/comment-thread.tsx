"use client";

import { CommentList } from "./comment-list";

export type CommentThreadProps = {
  storyId: string;
  chapterId?: string | null;
  scope?: "story" | "chapter";
  title?: string;
  emptyText?: string;
  showComposer?: boolean;
  className?: string;
};

/**
 * A discussion thread for a story (scope="story") or a chapter (scope="chapter").
 */
export function CommentThread({
  storyId,
  chapterId = null,
  scope = "story",
  title,
  emptyText,
  showComposer = true,
  className,
}: CommentThreadProps) {
  return (
    <CommentList
      storyId={storyId}
      scope={scope}
      chapterId={scope === "chapter" ? chapterId : null}
      title={title ?? (scope === "chapter" ? "Chapter discussion" : "Story discussion")}
      emptyText={emptyText}
      showComposer={showComposer}
      className={className}
    />
  );
}

export default CommentThread;
