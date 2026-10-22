import { and, eq, isNull, sql } from "drizzle-orm";

import { comments, db } from "@lekh/db";

import type { CommentCounts } from "@/components/comments/types";

import { resolveAccess } from "../_lib";

export const dynamic = "force-dynamic";

/**
 * GET /api/comments/counts?storyId=
 * Counts per scope, used for the UI badges.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const storyId = url.searchParams.get("storyId");
  if (!storyId) {
    return Response.json({ error: "storyId is required" }, { status: 400 });
  }

  const { story, allowed } = await resolveAccess(storyId);
  if (!story) {
    return Response.json({ error: "Story not found" }, { status: 404 });
  }
  if (!allowed) {
    return Response.json({ error: "You do not have access to this story" }, { status: 403 });
  }

  const rows = await db
    .select({
      chapterId: comments.chapterId,
      blockId: comments.blockId,
      count: sql<number>`count(*)`,
    })
    .from(comments)
    .where(
      and(
        eq(comments.storyId, storyId),
        isNull(comments.parentId),
        isNull(comments.deletedAt),
      ),
    )
    .groupBy(comments.chapterId, comments.blockId);

  let storyCount = 0;
  let chapterCount = 0;
  let inlineCount = 0;
  const byChapter: Record<string, number> = {};
  const byBlock: Record<string, number> = {};

  for (const row of rows) {
    const count = Number(row.count);
    if (row.blockId) {
      inlineCount += count;
      byBlock[row.blockId] = (byBlock[row.blockId] ?? 0) + count;
      continue;
    }
    if (row.chapterId) {
      chapterCount += count;
      byChapter[row.chapterId] = (byChapter[row.chapterId] ?? 0) + count;
      continue;
    }
    storyCount += count;
  }

  const payload: CommentCounts = {
    storyId,
    story: storyCount,
    chapter: chapterCount,
    inline: inlineCount,
    total: storyCount + chapterCount + inlineCount,
    byChapter,
    byBlock,
  };

  return Response.json(payload);
}
