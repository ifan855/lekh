import { NextResponse } from "next/server";

import { db, stories } from "@lekh/db";
import { eq } from "drizzle-orm";

import { getStoryById } from "@/app/admin/_lib/data";
import { bool, jsonError, readJson, requireAdminApi, writeAudit } from "@/app/admin/_lib/server";

/** POST /api/admin/stories/[id]/feature  { featured: boolean } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;
  const { id } = await params;

  const body = await readJson(request);
  const featured = bool(body.featured);
  if (featured === null) return jsonError("featured must be a boolean", 400);

  const story = await getStoryById(id);
  if (!story) return jsonError("story not found", 404);

  await db.update(stories).set({ featured, updatedAt: new Date() }).where(eq(stories.id, id));

  await writeAudit({
    actorId: viewer.userId,
    action: "story.feature",
    targetType: "story",
    targetId: id,
    meta: { title: story.title, from: story.featured, to: featured },
  });

  return NextResponse.json({ ok: true, id, featured });
}
