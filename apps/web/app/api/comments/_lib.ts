import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getStoryAccess } from "@lekh/core";
import { chapterBlocks, chapters, comments, db, profiles, stories } from "@lekh/db";

import { getViewer } from "@/lib/session";
import type { Viewer } from "@/lib/session";

import type { CommentAuthor, CommentDto, CommentScope, CommentViewer } from "@/components/comments/types";

export const MAX_COMMENT_LENGTH = 2000;
export const MAX_QUOTE_LENGTH = 600;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

export type CoreViewer = { id: string; role: "user" | "admin" } | null;

/** The current viewer in the shape `getStoryAccess` expects. */
export async function getCoreViewer(): Promise<{ viewer: Viewer | null; core: CoreViewer }> {
  const viewer = await getViewer();
  if (!viewer) return { viewer: null, core: null };
  return { viewer, core: { id: viewer.userId, role: viewer.role } };
}

export async function loadStory(storyId: string) {
  const rows = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Can this viewer see the story at all?
 * - public / unlisted: yes for everyone
 * - private: author, co-authors and admins only
 */
export async function resolveAccess(storyId: string) {
  const { viewer, core } = await getCoreViewer();
  const story = await loadStory(storyId);
  if (!story) return { viewer, story: null, access: null, allowed: false };
  const access = await getStoryAccess(story, core);
  // Owners / co-authors may comment on their own private story; everybody else
  // needs the story to be publicly readable.
  const allowed = access.canView && (access.canComment || access.canEdit);
  return { viewer, story, access, allowed };
}

export function viewerPayload(viewer: Viewer | null): CommentViewer | null {
  if (!viewer) return null;
  return {
    id: viewer.userId,
    username: viewer.username,
    displayName: viewer.displayName,
    avatarKey: viewer.avatarKey,
    role: viewer.role,
  };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function parseIntParam(raw: string | null, fallback: number, max: number): number {
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

/** Which chapter a block belongs to (used when the caller only knows the block). */
export async function chapterIdForBlock(blockId: string): Promise<string | null> {
  const rows = await db
    .select({ chapterId: chapterBlocks.chapterId })
    .from(chapterBlocks)
    .where(eq(chapterBlocks.id, blockId))
    .limit(1);
  return rows[0]?.chapterId ?? null;
}

export async function chapterBelongsToStory(chapterId: string, storyId: string): Promise<boolean> {
  const rows = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.storyId, storyId)))
    .limit(1);
  return rows.length > 0;
}

export async function blockBelongsToChapter(blockId: string, chapterId: string): Promise<boolean> {
  const rows = await db
    .select({ id: chapterBlocks.id })
    .from(chapterBlocks)
    .where(and(eq(chapterBlocks.id, blockId), eq(chapterBlocks.chapterId, chapterId)))
    .limit(1);
  return rows.length > 0;
}

export type ScopeFilter = {
  scope: CommentScope;
  chapterId: string | null;
  blockId: string | null;
};

/**
 * Work out which slice of the wall we are looking at.
 * - inline   : story + chapter + block
 * - chapter  : story + chapter
 * - story    : story only
 */
export function scopeFilter(
  storyId: string,
  scope: CommentScope,
  chapterId: string | null,
  blockId: string | null,
) {
  if (scope === "inline") {
    return and(
      eq(comments.storyId, storyId),
      eq(comments.chapterId, chapterId ?? ""),
      eq(comments.blockId, blockId ?? ""),
    );
  }
  if (scope === "chapter") {
    return and(
      eq(comments.storyId, storyId),
      eq(comments.chapterId, chapterId ?? ""),
      isNull(comments.blockId),
    );
  }
  return and(eq(comments.storyId, storyId), isNull(comments.chapterId), isNull(comments.blockId));
}

export const commentColumns = {
  id: comments.id,
  storyId: comments.storyId,
  chapterId: comments.chapterId,
  blockId: comments.blockId,
  quotedText: comments.quotedText,
  parentId: comments.parentId,
  body: comments.body,
  createdAt: comments.createdAt,
  updatedAt: comments.updatedAt,
  deletedAt: comments.deletedAt,
  authorId: comments.authorId,
  authorUsername: profiles.username,
  authorDisplayName: profiles.displayName,
  authorAvatarKey: profiles.avatarKey,
};

export type CommentRow = {
  id: string;
  storyId: string;
  chapterId: string | null;
  blockId: string | null;
  quotedText: string | null;
  parentId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarKey: string | null;
};

export function toCommentDto(row: CommentRow, replies: CommentDto[] = []): CommentDto {
  const author: CommentAuthor = {
    id: row.authorId,
    username: row.authorUsername,
    displayName: row.authorDisplayName,
    avatarKey: row.authorAvatarKey,
  };
  return {
    id: row.id,
    storyId: row.storyId,
    chapterId: row.chapterId,
    blockId: row.blockId,
    quotedText: row.quotedText,
    parentId: row.parentId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    author,
    replies,
  };
}

/** Top-level comments for a scope, oldest last, with one level of replies. */
export async function listComments(
  storyId: string,
  filter: ScopeFilter,
  limit: number,
  offset: number,
): Promise<{ comments: CommentDto[]; total: number }> {
  const scopeWhere = scopeFilter(storyId, filter.scope, filter.chapterId, filter.blockId);

  const topRows = await db
    .select(commentColumns)
    .from(comments)
    .innerJoin(profiles, eq(profiles.id, comments.authorId))
    .where(and(scopeWhere, isNull(comments.parentId)))
    .orderBy(desc(comments.createdAt))
    .limit(limit)
    .offset(offset);

  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(and(scopeWhere, isNull(comments.parentId), isNull(comments.deletedAt)));

  // Newest last.
  const ordered = [...topRows].reverse();

  const parentIds = ordered.map((row) => row.id);
  let replyRows: CommentRow[] = [];
  if (parentIds.length > 0) {
    replyRows = await db
      .select(commentColumns)
      .from(comments)
      .innerJoin(profiles, eq(profiles.id, comments.authorId))
      .where(inArray(comments.parentId, parentIds))
      .orderBy(asc(comments.createdAt));
  }

  const repliesByParent = new Map<string, CommentDto[]>();
  for (const row of replyRows) {
    if (!row.parentId) continue;
    const list = repliesByParent.get(row.parentId) ?? [];
    list.push(toCommentDto(row));
    repliesByParent.set(row.parentId, list);
  }

  return {
    comments: ordered.map((row) => toCommentDto(row, repliesByParent.get(row.id) ?? [])),
    total: Number(totalRows[0]?.count ?? 0),
  };
}
