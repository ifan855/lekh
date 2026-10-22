import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getStoryAccess } from "@lekh/core";
import { db, parts, stories } from "@lekh/db";

import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  title: z.string().trim().max(200).optional().default(""),
  position: z.number().int().optional(),
});

export async function POST(request: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const storyRows = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  const story = storyRows[0];
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getStoryAccess(story, viewer);
  if (!access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid part" }, { status: 400 });

  const existing = await db.select().from(parts).where(eq(parts.storyId, id)).orderBy(asc(parts.position));
  const position = parsed.data.position ?? existing.length;

  const inserted = await db
    .insert(parts)
    .values({ storyId: id, title: parsed.data.title, position })
    .returning();

  return NextResponse.json({ part: inserted[0] }, { status: 201 });
}
