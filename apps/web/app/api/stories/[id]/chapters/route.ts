import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getStoryAccess } from "@lekh/core";
import { db, chapters, parts, stories } from "@lekh/db";

import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const createChapterSchema = z.object({
  title: z.string().trim().max(200).optional().default(""),
  partId: z.string().uuid().nullable().optional(),
  position: z.number().int().optional(),
});

export async function GET(_request: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const rows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.storyId, id))
    .orderBy(asc(chapters.position));
  return NextResponse.json({ chapters: rows });
}

export async function POST(request: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const storyRows = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  const story = storyRows[0];
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getStoryAccess(story, viewer);
  if (!access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createChapterSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
  }
  const input = parsed.data;

  const maxRow = await db
    .select({ max: sql<number>`coalesce(max(${chapters.position}), -1)` })
    .from(chapters)
    .where(eq(chapters.storyId, id));
  const position = input.position ?? Number(maxRow[0]?.max ?? -1) + 1;

  const inserted = await db
    .insert(chapters)
    .values({
      storyId: id,
      partId: input.partId ?? null,
      title: input.title,
      position,
      content: { type: "doc", content: [{ type: "paragraph", attrs: {}, content: [] }] },
    })
    .returning();

  await db
    .update(stories)
    .set({ chapterCount: Number(maxRow[0]?.max ?? -1) + 2, updatedAt: new Date() })
    .where(eq(stories.id, id));

  return NextResponse.json({ chapter: inserted[0] }, { status: 201 });
}
