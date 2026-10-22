import { and, eq } from "drizzle-orm";

import { commentReports, comments, db } from "@lekh/db";

import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/comments/[id]/report
 * body: { reason?: string } — reason is optional.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const viewer = await getViewer();
  if (!viewer) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 500) : "";

  const commentRows = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, id)).limit(1);
  if (!commentRows[0]) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  // One open report per reporter is enough.
  const existing = await db
    .select({ id: commentReports.id, createdAt: commentReports.createdAt })
    .from(commentReports)
    .where(
      and(
        eq(commentReports.commentId, id),
        eq(commentReports.reporterId, viewer.userId),
        eq(commentReports.status, "open"),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return Response.json({
      ok: true,
      id: existing[0].id,
      createdAt: existing[0].createdAt.toISOString(),
      duplicate: true,
    });
  }

  const inserted = await db
    .insert(commentReports)
    .values({ commentId: id, reporterId: viewer.userId, reason })
    .returning({ id: commentReports.id, createdAt: commentReports.createdAt });

  const row = inserted[0];
  if (!row) {
    return Response.json({ error: "Could not report comment" }, { status: 500 });
  }

  return Response.json(
    { ok: true, id: row.id, createdAt: row.createdAt.toISOString(), duplicate: false },
    { status: 201 },
  );
}
