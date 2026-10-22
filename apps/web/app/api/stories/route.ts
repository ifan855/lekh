import { and, desc, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureProfile, slugify } from "@lekh/core";
import { db, stories } from "@lekh/db";

import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

const createStorySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().default(""),
  language: z.string().trim().min(2).max(8).optional().default("en"),
  visibility: z.enum(["public", "unlisted", "private"]).optional().default("public"),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional().default([]),
  fontPreset: z.string().optional().default("literary"),
});

/** List the stories the signed-in user owns or co-writes. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await db
    .select()
    .from(stories)
    .where(eq(stories.authorId, viewer.userId))
    .orderBy(desc(stories.updatedAt));

  return NextResponse.json({ stories: owned });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createStorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid story", details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const base = slugify(input.title);
  let slug = base;
  let attempt = 1;
  while (
    await db
      .select({ id: stories.id })
      .from(stories)
      .where(and(eq(stories.authorId, viewer.userId), eq(stories.slug, slug)))
      .limit(1)
  ) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  const inserted = await db
    .insert(stories)
    .values({
      authorId: viewer.userId,
      title: input.title,
      slug,
      description: input.description,
      language: input.language,
      visibility: input.visibility,
      tags: input.tags,
      fontPreset: input.fontPreset,
      status: "draft",
    })
    .returning();

  return NextResponse.json({ story: inserted[0] }, { status: 201 });
}
