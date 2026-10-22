import { eq, sql } from "drizzle-orm";

import { comments, db, stories } from "@lekh/db";

import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/comments/[id]
 * Soft-deletes a comment (sets deletedAt). Allowed for the comment author and
 * for admins.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const viewer = await getViewer();
  if (!viewer) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const rows = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  const comment = rows[0];
  if (!comment) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  if (comment.authorId !== viewer.userId && viewer.role !== "admin") {
    return Response.json({ error: "You cannot delete this comment" }, { status: 403 });
  }

  if (comment.deletedAt) {
    return Response.json({ ok: true, id, deletedAt: comment.deletedAt.toISOString() });
  }

  const now = new Date();
  await db
    .update(comments)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(comments.id, id));

  await db
    .update(stories)
    .set({ commentCount: sql`greatest(${stories.commentCount} - 1, 0)` })
    .where(eq(stories.id, comment.storyId));

  return Response.json({ ok: true, id, deletedAt: now.toISOString() });
}
