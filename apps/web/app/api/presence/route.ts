import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db, editorPresence, profiles } from "@lekh/db";

import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  chapterId: z.string().uuid(),
  blockId: z.string().uuid().nullable().optional(),
  offset: z.number().int().min(0).optional(),
});

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const chapterId = url.searchParams.get("chapterId");
  if (!chapterId) return NextResponse.json({ error: "chapterId required" }, { status: 400 });

  const cutoff = new Date(Date.now() - 12_000);
  const rows = await db
    .select({
      userId: editorPresence.userId,
      blockId: editorPresence.blockId,
      offset: editorPresence.offset,
      updatedAt: editorPresence.updatedAt,
      displayName: profiles.displayName,
      username: profiles.username,
      avatarKey: profiles.avatarKey,
    })
    .from(editorPresence)
    .innerJoin(profiles, eq(profiles.id, editorPresence.userId))
    .where(and(eq(editorPresence.chapterId, chapterId), gt(editorPresence.updatedAt, cutoff)))
    .limit(20);

  return NextResponse.json({ presence: rows });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid presence payload" }, { status: 400 });

  const { chapterId, blockId, offset } = parsed.data;

  const existing = await db
    .select()
    .from(editorPresence)
    .where(and(eq(editorPresence.chapterId, chapterId), eq(editorPresence.userId, viewer.userId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(editorPresence)
      .set({ blockId: blockId ?? null, offset: offset ?? 0, active: true, updatedAt: new Date() })
      .where(eq(editorPresence.id, existing[0].id));
  } else {
    await db.insert(editorPresence).values({
      chapterId,
      userId: viewer.userId,
      blockId: blockId ?? null,
      offset: offset ?? 0,
    });
  }

  return NextResponse.json({ ok: true });
}
