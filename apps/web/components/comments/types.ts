/**
 * Shared comment types + event contract.
 *
 * This module is imported by both the API route handlers (types only) and the
 * client components, so it must stay free of server-only imports.
 */

export type CommentScope = "story" | "chapter" | "inline";

export type CommentAuthor = {
  id: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
};

export type CommentViewer = CommentAuthor & {
  role: "user" | "admin";
};

export type CommentDto = {
  id: string;
  storyId: string;
  chapterId: string | null;
  blockId: string | null;
  quotedText: string | null;
  parentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  author: CommentAuthor | null;
  replies: CommentDto[];
};

export type CommentsResponse = {
  comments: CommentDto[];
  total: number;
  scope: CommentScope;
  limit: number;
  offset: number;
  viewer: CommentViewer | null;
};

export type CommentCounts = {
  storyId: string;
  story: number;
  chapter: number;
  inline: number;
  total: number;
  byChapter: Record<string, number>;
  byBlock: Record<string, number>;
};

export type CommentSession = {
  signedIn: boolean;
  user: CommentViewer | null;
};

export type CreateCommentInput = {
  storyId: string;
  chapterId?: string | null;
  blockId?: string | null;
  quotedText?: string | null;
  parentId?: string | null;
  body: string;
};

/* ------------------------------------------------------------------ *
 * Reader <-> comments contract (window CustomEvents)
 * ------------------------------------------------------------------ */

/** Open the comments sheet. detail: { scope, storyId, chapterId?, blockId? } */
export const COMMENTS_OPEN_EVENT = "lekh:comments-open";

/**
 * Ask for an inline comment on a block. detail: { blockId, quote, storyId?, chapterId? }
 */
export const COMMENT_REQUEST_EVENT = "lekh:comment-request";

export type CommentsOpenDetail = {
  scope?: CommentScope;
  storyId?: string;
  chapterId?: string | null;
  blockId?: string | null;
};

export type CommentRequestDetail = {
  blockId: string;
  quote?: string;
  storyId?: string;
  chapterId?: string | null;
};

/** Convenience helper the reader can call to open the comments sheet. */
export function openComments(detail: CommentsOpenDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CommentsOpenDetail>(COMMENTS_OPEN_EVENT, { detail }));
}

/** Convenience helper the reader can call to start an inline comment. */
export function requestInlineComment(detail: CommentRequestDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CommentRequestDetail>(COMMENT_REQUEST_EVENT, { detail }));
}
