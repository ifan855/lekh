import { NextResponse } from "next/server";

import { db, stories } from "@lekh/db";
import { eq } from "drizzle-orm";

import { getStoryById } from "@/app/admin/_lib/data";
import { jsonError, requireAdminApi, writeAudit } from "@/app/admin/_lib/server";

/**
 * DELETE /api/admin/stories/[id]
 *
 * Hard delete: the story and everything that belongs to it (parts, chapters,
 * blocks, comments, favourites, read events) are removed. The panel asks for
 * an explicit confirmation before calling this.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;
  const { id } = await params;

  const story = await getStoryById(id);
  if (!story) return jsonError("story not found", 404);

  await db.delete(stories).where(eq(stories.id, id));

  await writeAudit({
    actorId: viewer.userId,
    action: "story.delete",
    targetType: "story",
    targetId: id,
    meta: {
      title: story.title,
      slug: story.slug,
      author: story.authorUsername,
      chapters: story.chapterCount,
    },
  });

  return NextResponse.json({ ok: true, id });
}
