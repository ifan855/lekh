import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getStoryAccess } from "@lekh/core";
import { db, parts, stories } from "@lekh/db";

import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  title: z.string().trim().max(200).optional(),
  position: z.number().int().optional(),
  thumbnailKey: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const rows = await db.select().from(parts).where(eq(parts.id, id)).limit(1);
  const part = rows[0];
  if (!part) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const storyRows = await db.select().from(stories).where(eq(stories.id, part.storyId)).limit(1);
  const access = await getStoryAccess(storyRows[0], viewer);
  if (!access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid part" }, { status: 400 });

  const updated = await db
    .update(parts)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(parts.id, id))
    .returning();

  return NextResponse.json({ part: updated[0] });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const rows = await db.select().from(parts).where(eq(parts.id, id)).limit(1);
  const part = rows[0];
  if (!part) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const storyRows = await db.select().from(stories).where(eq(stories.id, part.storyId)).limit(1);
  const access = await getStoryAccess(storyRows[0], viewer);
  if (!access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(parts).where(eq(parts.id, id));
  return NextResponse.json({ ok: true });
}
