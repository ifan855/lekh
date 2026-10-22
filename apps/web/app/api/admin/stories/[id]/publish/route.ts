import { NextResponse } from "next/server";

import { db, stories } from "@lekh/db";
import { eq } from "drizzle-orm";

import { getStoryById } from "@/app/admin/_lib/data";
import { jsonError, readJson, requireAdminApi, str, writeAudit } from "@/app/admin/_lib/server";

const STATUSES = ["draft", "published"] as const;

/** POST /api/admin/stories/[id]/publish  { status: 'draft' | 'published' } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;
  const { id } = await params;

  const body = await readJson(request);
  const status = str(body.status);
  if (!status || !(STATUSES as readonly string[]).includes(status)) {
    return jsonError("status must be draft or published", 400);
  }

  const story = await getStoryById(id);
  if (!story) return jsonError("story not found", 404);

  const publishedAt = status === "published" ? story.publishedAt ?? new Date() : null;
  await db
    .update(stories)
    .set({ status, publishedAt, updatedAt: new Date() })
    .where(eq(stories.id, id));

  await writeAudit({
    actorId: viewer.userId,
    action: status === "published" ? "story.publish" : "story.unpublish",
    targetType: "story",
    targetId: id,
    meta: { title: story.title, from: story.status, to: status },
  });

  return NextResponse.json({ ok: true, id, status });
}
