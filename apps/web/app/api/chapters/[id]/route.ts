import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getStoryAccess } from "@lekh/core";
import { chapterBlocks, chapters, stories } from "@lekh/db";

import { db } from "@lekh/db";
import { getViewer } from "@/lib/session";
import {
  blocksPlainText,
  blocksWordCount,
  docToEditorBlocks,
  editorBlocksToDoc,
  type EditorBlock,
} from "@/lib/writer/blocks";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().trim().max(200).optional(),
  partId: z.string().uuid().nullable().optional(),
  position: z.number().int().optional(),
  thumbnailKey: z.string().nullable().optional(),
  isLocked: z.boolean().optional(),
  content: z.any().optional(),
  blocks: z.array(z.any()).optional(),
});

async function loadChapter(id: string) {
  const chapterRows = await db.select().from(chapters).where(eq(chapters.id, id)).limit(1);
  const chapter = chapterRows[0];
  if (!chapter) return null;
  const storyRows = await db.select().from(stories).where(eq(stories.id, chapter.storyId)).limit(1);
  return { chapter, story: storyRows[0] };
}

export async function GET(_request: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const loaded = await loadChapter(id);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getStoryAccess(loaded.story, viewer);
  if (!access.canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const blocks = await db
    .select()
    .from(chapterBlocks)
    .where(eq(chapterBlocks.chapterId, id))
    .orderBy(asc(chapterBlocks.position));

  return NextResponse.json({ chapter: loaded.chapter, blocks });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const loaded = await loadChapter(id);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await getStoryAccess(loaded.story, viewer);
  if (!access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chapter update" }, { status: 400 });
  }
  const input = parsed.data;

  const existing = await db
    .select()
    .from(chapterBlocks)
    .where(eq(chapterBlocks.chapterId, id))
    .orderBy(asc(chapterBlocks.position));
  const existingById = new Map(existing.map((b) => [b.id, b]));

  let incoming: EditorBlock[] = [];
  if (Array.isArray(input.blocks) && input.blocks.length) {
    incoming = input.blocks as EditorBlock[];
  } else if (input.content) {
    incoming = docToEditorBlocks(input.content);
  }

  // Last-write-wins per block, using the timestamps each client last saw.
  const merged = new Map<string, EditorBlock>();
  for (const block of existing) {
    merged.set(block.id, {
      type: block.kind as EditorBlock["type"],
      attrs: {},
      content: block.content,
      plainText: block.plainText,
      deleted: block.deleted,
      updatedAt: block.updatedAt.toISOString(),
    });
  }
  for (const block of incoming) {
    const id2 = (block.attrs?.id as string | undefined) ?? "";
    if (!id2) continue;
    const current = merged.get(id2);
    const incomingAt = block.updatedAt ? Date.parse(block.updatedAt) : Date.now();
    const currentAt = current?.updatedAt ? Date.parse(current.updatedAt) : 0;
    if (current && incomingAt < currentAt) continue; // a newer remote edit wins
    merged.set(id2, {
      ...block,
      attrs: { ...block.attrs, id: id2 },
      updatedAt: new Date(incomingAt).toISOString(),
    });
  }

  const ordered = Array.from(merged.values()).filter((b) => b.plainText || b.type !== "paragraph");
  const doc = editorBlocksToDoc(ordered);
  const plainText = blocksPlainText(ordered);
  const wordCount = blocksWordCount(ordered);

  await db.transaction(async (tx) => {
    await tx.delete(chapterBlocks).where(eq(chapterBlocks.chapterId, id));
    if (ordered.length) {
      await tx.insert(chapterBlocks).values(
        ordered.map((block, index) => ({
          id: (block.attrs?.id as string) as string,
          chapterId: id,
          position: index,
          kind: block.type,
          content: block.content ?? [],
          plainText: block.plainText ?? "",
          deleted: block.deleted ?? false,
          authorId: viewer.userId,
        })),
      );
    }
    await tx
      .update(chapters)
      .set({
        title: input.title ?? loaded.chapter.title,
        partId: input.partId === undefined ? loaded.chapter.partId : input.partId,
        position: input.position ?? loaded.chapter.position,
        thumbnailKey: input.thumbnailKey === undefined ? loaded.chapter.thumbnailKey : input.thumbnailKey,
        isLocked: input.isLocked ?? loaded.chapter.isLocked,
        content: doc,
        plainText,
        wordCount,
        updatedAt: new Date(),
      })
      .where(eq(chapters.id, id));
  });

  const blocks = await db
    .select()
    .from(chapterBlocks)
    .where(eq(chapterBlocks.chapterId, id))
    .orderBy(asc(chapterBlocks.position));

  return NextResponse.json({ ok: true, blocks, updatedAt: new Date().toISOString() });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const loaded = await loadChapter(id);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await getStoryAccess(loaded.story, viewer);
  if (!access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(chapters).where(eq(chapters.id, id));
  await db
    .update(stories)
    .set({ chapterCount: 0, updatedAt: new Date() })
    .where(eq(stories.id, loaded.chapter.storyId));

  return NextResponse.json({ ok: true });
}
