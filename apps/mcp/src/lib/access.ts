import { getStoryAccess, slugify } from "@lekh/core";
import { db, chapters, parts, stories } from "@lekh/db";
import type { Chapter, Part, Story } from "@lekh/db";
import { eq, sql } from "drizzle-orm";

import type { ToolContext } from "../types.js";

export async function loadStory(storyId: string): Promise<Story | null> {
  const rows = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  return rows[0] ?? null;
}

export async function loadChapter(chapterId: string): Promise<Chapter | null> {
  const rows = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  return rows[0] ?? null;
}

export async function loadPart(partId: string): Promise<Part | null> {
  const rows = await db.select().from(parts).where(eq(parts.id, partId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Load a story and assert the caller may view (or edit) it. Ids alone are
 * never trusted: owners, co-authors (story_editors) and admins only.
 */
export async function requireStory(
  ctx: ToolContext,
  storyId: string,
  mode: "view" | "edit",
): Promise<{ story: Story; canEdit: boolean; isOwner: boolean }> {
  const story = await loadStory(storyId);
  if (!story) throw new Error(`Story ${storyId} was not found.`);
  const access = await getStoryAccess(story, ctx.viewer);
  if (mode === "edit" && !access.canEdit) {
    throw new Error(
      `You are not allowed to edit story ${storyId}. Only the owner, its co-authors and admins can.`,
    );
  }
  if (mode === "view" && !access.canView) {
    throw new Error(`You are not allowed to view story ${storyId}.`);
  }
  return { story, canEdit: access.canEdit, isOwner: access.isOwner };
}

export async function requireChapter(
  ctx: ToolContext,
  chapterId: string,
  mode: "view" | "edit",
): Promise<{ chapter: Chapter; story: Story }> {
  const chapter = await loadChapter(chapterId);
  if (!chapter) throw new Error(`Chapter ${chapterId} was not found.`);
  const { story } = await requireStory(ctx, chapter.storyId, mode);
  return { chapter, story };
}

export async function requirePart(
  ctx: ToolContext,
  partId: string,
  mode: "view" | "edit",
): Promise<{ part: Part; story: Story }> {
  const part = await loadPart(partId);
  if (!part) throw new Error(`Part ${partId} was not found.`);
  const { story } = await requireStory(ctx, part.storyId, mode);
  return { part, story };
}

/** Unique slug for a new story of this author. */
export async function uniqueSlug(authorId: string, title: string): Promise<string> {
  const base = slugify(title);
  const rows = await db
    .select({ slug: stories.slug })
    .from(stories)
    .where(sql`${stories.authorId} = ${authorId} and ${stories.slug} like ${`${base}%`}`);
  const taken = new Set(rows.map((row) => row.slug));
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

export function storySummary(story: Story) {
  return {
    id: story.id,
    title: story.title,
    slug: story.slug,
    description: story.description,
    status: story.status,
    visibility: story.visibility,
    language: story.language,
    fontPreset: story.fontPreset,
    tags: story.tags,
    isCompleted: story.isCompleted,
    wordCount: story.wordCount,
    chapterCount: story.chapterCount,
    authorId: story.authorId,
    updatedAt: story.updatedAt,
  };
}
