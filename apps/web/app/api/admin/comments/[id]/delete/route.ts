import { NextResponse } from "next/server";

import { db, comments } from "@lekh/db";
import { eq } from "drizzle-orm";

import { jsonError, requireAdminApi, writeAudit } from "@/app/admin/_lib/server";

/**
 * POST /api/admin/comments/[id]/delete
 *
 * Removes the comment from the site. Any open reports on that comment are
 * removed with it (the audit log keeps the record of the moderation action).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;
  const { id } = await params;

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      storyId: comments.storyId,
      authorId: comments.authorId,
      deletedAt: comments.deletedAt,
    })
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1);

  const comment = rows[0];
  if (!comment) return jsonError("comment not found", 404);

  await db.delete(comments).where(eq(comments.id, id));

  await writeAudit({
    actorId: viewer.userId,
    action: "comment.delete",
    targetType: "comment",
    targetId: id,
    meta: {
      storyId: comment.storyId,
      authorId: comment.authorId,
      excerpt: comment.body.slice(0, 160),
      wasSoftDeleted: Boolean(comment.deletedAt),
    },
  });

  return NextResponse.json({ ok: true, id });
}
