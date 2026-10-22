import { NextResponse } from "next/server";

import { editableStoryIds } from "@lekh/core";
import { chapters, db, stories } from "@lekh/db";
import { asc, inArray } from "drizzle-orm";

import { isResponse, jsonError, requireOcrUser } from "../_shared";
import type { OcrTarget } from "@/components/ocr/types";

export const dynamic = "force-dynamic";

/**
 * The stories (and chapters) the writer may add text to.
 *
 * Used by the panel when it is opened without a story/chapter preset.
 */
export async function GET() {
  const viewer = await requireOcrUser();
  if (isResponse(viewer)) return viewer;

  let ids: string[];
  try {
    ids = await editableStoryIds(viewer.userId);
  } catch {
    return jsonError("Could not load your stories right now.", 500);
  }

  if (!ids.length) return NextResponse.json({ targets: [] as OcrTarget[] });

  const storyRows = await db
    .select({ id: stories.id, title: stories.title })
    .from(stories)
    .where(inArray(stories.id, ids))
    .orderBy(asc(stories.title));

  const chapterRows = await db
    .select({ id: chapters.id, storyId: chapters.storyId, title: chapters.title })
    .from(chapters)
    .where(inArray(chapters.storyId, ids))
    .orderBy(asc(chapters.position));

  const targets: OcrTarget[] = storyRows.map((story) => ({
    id: story.id,
    title: story.title,
    chapters: chapterRows
      .filter((chapter) => chapter.storyId === story.id)
      .map((chapter) => ({ id: chapter.id, title: chapter.title || "Untitled chapter" })),
  }));

  return NextResponse.json({ targets });
}
