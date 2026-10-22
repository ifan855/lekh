import { NextResponse } from "next/server";

import { db, commentReports } from "@lekh/db";
import { eq } from "drizzle-orm";

import { jsonError, readJson, requireAdminApi, str, writeAudit } from "@/app/admin/_lib/server";

const STATUSES = ["resolved", "dismissed"] as const;

/** POST /api/admin/reports/[id]/resolve  { status: 'resolved' | 'dismissed' } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;
  const { id } = await params;

  const body = await readJson(request);
  const status = str(body.status);
  if (!status || !(STATUSES as readonly string[]).includes(status)) {
    return jsonError("status must be resolved or dismissed", 400);
  }

  const rows = await db
    .select({ id: commentReports.id, status: commentReports.status, commentId: commentReports.commentId })
    .from(commentReports)
    .where(eq(commentReports.id, id))
    .limit(1);

  const report = rows[0];
  if (!report) return jsonError("report not found", 404);

  await db.update(commentReports).set({ status }).where(eq(commentReports.id, id));

  await writeAudit({
    actorId: viewer.userId,
    action: status === "resolved" ? "report.resolve" : "report.dismiss",
    targetType: "comment_report",
    targetId: id,
    meta: { commentId: report.commentId, from: report.status, to: status },
  });

  return NextResponse.json({ ok: true, id, status });
}
