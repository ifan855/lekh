import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db, stories, storyReadEvents, storyReads } from "@lekh/db";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

type Body = { storyId?: string; chapterId?: string | null };

function dayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Record that the viewer opened a story.
 *
 * - appends a row to `story_read_events` (used by the trending score)
 * - increments `stories.read_count`
 * - upserts `story_reads` for signed-in readers
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const storyId = body.storyId?.trim();
  if (!storyId) {
    return NextResponse.json({ error: "storyId is required." }, { status: 400 });
  }

  const viewer = await getViewer();
  const userId = viewer?.userId ?? null;
  const chapterId = body.chapterId?.trim() || null;

  const story = await db.select({ id: stories.id }).from(stories).where(eq(stories.id, storyId)).limit(1);
  if (story.length === 0) {
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  }

  await db.insert(storyReadEvents).values({
    storyId,
    userId,
    chapterId,
    day: dayStamp(),
  });

  await db
    .update(stories)
    .set({ readCount: sql`${stories.readCount} + 1` })
    .where(eq(stories.id, storyId));

  if (userId) {
    await db
      .insert(storyReads)
      .values({ storyId, userId, readCount: 1, lastReadAt: new Date() })
      .onConflictDoUpdate({
        target: [storyReads.storyId, storyReads.userId],
        set: {
          readCount: sql`${storyReads.readCount} + 1`,
          lastReadAt: new Date(),
        },
      });
  }

  return NextResponse.json({ ok: true });
}

/** Remove a recorded read (used when a reader resets their history). */
export async function DELETE(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const storyId = body.storyId?.trim();
  if (!storyId) {
    return NextResponse.json({ error: "storyId is required." }, { status: 400 });
  }

  await db
    .delete(storyReads)
    .where(and(eq(storyReads.storyId, storyId), eq(storyReads.userId, viewer.userId)));

  return NextResponse.json({ ok: true });
}
