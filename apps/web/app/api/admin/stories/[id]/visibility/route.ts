import { NextResponse } from "next/server";

import { db, stories } from "@lekh/db";
import { eq } from "drizzle-orm";

import { getStoryById } from "@/app/admin/_lib/data";
import { jsonError, readJson, requireAdminApi, str, writeAudit } from "@/app/admin/_lib/server";

const VISIBILITIES = ["public", "unlisted", "private"] as const;

/** POST /api/admin/stories/[id]/visibility  { visibility } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;
  const { id } = await params;

  const body = await readJson(request);
  const visibility = str(body.visibility);
  if (!visibility || !(VISIBILITIES as readonly string[]).includes(visibility)) {
    return jsonError("visibility must be public, unlisted or private", 400);
  }

  const story = await getStoryById(id);
  if (!story) return jsonError("story not found", 404);

  await db.update(stories).set({ visibility, updatedAt: new Date() }).where(eq(stories.id, id));

  await writeAudit({
    actorId: viewer.userId,
    action: "story.visibility",
    targetType: "story",
    targetId: id,
    meta: { title: story.title, from: story.visibility, to: visibility },
  });

  return NextResponse.json({ ok: true, id, visibility });
}
