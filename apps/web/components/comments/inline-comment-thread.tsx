"use client";

import { CommentList } from "./comment-list";

export type InlineCommentThreadProps = {
  storyId: string;
  chapterId?: string | null;
  blockId: string;
  /** The passage of text the comments are anchored to. */
  quotedText?: string | null;
  title?: string;
  emptyText?: string;
  showComposer?: boolean;
  /** Pre-fills the composer (e.g. with the selected passage). */
  composerInitialValue?: string;
  className?: string;
};

/**
 * Comments anchored to one block (paragraph) of a chapter.
 */
export function InlineCommentThread({
  storyId,
  chapterId,
  blockId,
  quotedText = null,
  title = "Comments on this passage",
  emptyText = "No comments on this passage yet.",
  showComposer = true,
  composerInitialValue = "",
  className,
}: InlineCommentThreadProps) {
  return (
    <CommentList
      storyId={storyId}
      scope="inline"
      chapterId={chapterId}
      blockId={blockId}
      quotedText={quotedText}
      title={title}
      emptyText={emptyText}
      showComposer={showComposer}
      composerInitialValue={composerInitialValue}
      className={className}
    />
  );
}

export default InlineCommentThread;
