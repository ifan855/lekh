import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getStoryAccess, type Viewer as CoreViewer } from "@lekh/core";
import { db, chapters, comments, follows, profiles, stories } from "@lekh/db";

import type { StorySummary } from "./types";

/** Full story row (needed for access checks). */
export async function getStoryRow(storyId: string) {
  const rows = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  return rows[0] ?? null;
}

/** Map the app session viewer onto the core viewer shape. */
export function toCoreViewer(viewer: { userId: string; role: string } | null): CoreViewer {
  if (!viewer) return null;
  return { id: viewer.userId, role: viewer.role === "admin" ? "admin" : "user" };
}

export type StoryAccessInfo = {
  canView: boolean;
  canEdit: boolean;
  canComment: boolean;
  isOwner: boolean;
};

export async function storyAccess(storyId: string, viewer: { userId: string; role: string } | null) {
  const story = await getStoryRow(storyId);
  if (!story) return null;
  const access = await getStoryAccess(story, toCoreViewer(viewer));
  return { story, access };
}

/** Comment counts per chapter for a story. */
export async function chapterCommentCounts(storyId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ chapterId: comments.chapterId, count: sql<number>`count(*)` })
    .from(comments)
    .where(and(eq(comments.storyId, storyId), sql`${comments.chapterId} is not null`))
    .groupBy(comments.chapterId);

  const out: Record<string, number> = {};
  for (const row of rows) {
    if (row.chapterId) out[row.chapterId] = Number(row.count);
  }
  return out;
}

/** Is the viewer following this author? */
export async function isFollowing(viewerId: string | null, authorId: string): Promise<boolean> {
  if (!viewerId) return false;
  const rows = await db
    .select({ authorId: follows.authorId })
    .from(follows)
    .where(and(eq(follows.followerId, viewerId), eq(follows.authorId, authorId)))
    .limit(1);
  return rows.length > 0;
}

/** Public profile by username. */
export async function getProfileByUsername(username: string) {
  const rows = await db.select().from(profiles).where(eq(profiles.username, username)).limit(1);
  return rows[0] ?? null;
}

/** Follower / following counts for a profile. */
export async function profileCounts(profileId: string) {
  const [followerRows, followingRows] = await Promise.all([
    db.select({ id: follows.followerId }).from(follows).where(eq(follows.authorId, profileId)),
    db.select({ id: follows.authorId }).from(follows).where(eq(follows.followerId, profileId)),
  ]);
  return { followers: followerRows.length, following: followingRows.length };
}

/** Stories written by a profile. */
export async function profileStories(
  profileId: string,
  includeUnlisted: boolean,
  viewerId?: string,
): Promise<StorySummary[]> {
  const { storiesByAuthor } = await import("@lekh/core");
  const rows = await storiesByAuthor(profileId, includeUnlisted, viewerId);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    language: row.language,
    coverKey: row.coverKey,
    coverColor: row.coverColor,
    tags: row.tags ?? [],
    fontPreset: row.fontPreset,
    wordCount: row.wordCount,
    chapterCount: row.chapterCount,
    readCount: row.readCount,
    commentCount: row.commentCount,
    featured: row.featured,
    isCompleted: row.isCompleted,
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
    authorId: row.authorId,
    authorName: row.authorName,
    authorUsername: row.authorUsername,
    authorAvatarKey: row.authorAvatarKey,
  }));
}

/** The next chapter after the one the reader last opened (or the first). */
export async function nextChapterFor(
  storyId: string,
  lastChapterId: string | null,
): Promise<{ id: string; title: string } | null> {
  const all = await db
    .select({ id: chapters.id, title: chapters.title, position: chapters.position })
    .from(chapters)
    .where(eq(chapters.storyId, storyId))
    .orderBy(chapters.position);

  if (all.length === 0) return null;
  if (!lastChapterId) return all[0];

  const index = all.findIndex((c) => c.id === lastChapterId);
  if (index < 0) return all[0];
  return all[index + 1] ?? all[index];
}

/** All chapters of a story, ordered. */
export async function storyChapters(storyId: string) {
  return db
    .select({
      id: chapters.id,
      partId: chapters.partId,
      title: chapters.title,
      position: chapters.position,
      wordCount: chapters.wordCount,
      thumbnailKey: chapters.thumbnailKey,
      isLocked: chapters.isLocked,
    })
    .from(chapters)
    .where(eq(chapters.storyId, storyId))
    .orderBy(chapters.position);
}

export { inArray, desc };
