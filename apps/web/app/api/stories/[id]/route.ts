import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getStoryAccess } from "@lekh/core";
import { db, stories } from "@lekh/db";

import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  language: z.string().trim().min(2).max(8).optional(),
  visibility: z.enum(["public", "unlisted", "private"]).optional(),
  status: z.enum(["draft", "published"]).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  contentWarnings: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  fontPreset: z.string().optional(),
  coverKey: z.string().nullable().optional(),
  coverColor: z.string().nullable().optional(),
  isCompleted: z.boolean().optional(),
  featured: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const rows = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  const story = rows[0];
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getStoryAccess(story, viewer);
  if (!access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update", details: parsed.error.flatten() }, { status: 400 });
  }

  const patch = parsed.data;
  const updated = await db
    .update(stories)
    .set({
      ...patch,
      updatedAt: new Date(),
      publishedAt:
        patch.status === "published"
          ? story.publishedAt ?? new Date()
          : patch.status === "draft"
            ? null
            : story.publishedAt,
    })
    .where(eq(stories.id, id))
    .returning();

  return NextResponse.json({ story: updated[0] });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const rows = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  const story = rows[0];
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getStoryAccess(story, viewer);
  if (!access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(stories).where(eq(stories.id, id));
  return NextResponse.json({ ok: true });
}
