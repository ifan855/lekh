import { countWords, withBlockIds } from "@lekh/core";
import { db, chapterBlocks, chapters, stories } from "@lekh/db";
import type { BlockNode, EditorDoc, InlineMark, InlineNode } from "@lekh/db";
import { asc, eq } from "drizzle-orm";

export type MarkType = "bold" | "italic" | "underline" | "strike" | "code" | "highlight";

/** A block an agent can write. Either `text` (+ optional `marks`) or `runs`. */
export type BlockInput = {
  type?: "paragraph" | "heading" | "blockquote";
  level?: 1 | 2 | 3;
  text?: string;
  marks?: MarkType[];
  runs?: { text: string; marks?: MarkType[] }[];
};

export function toMark(type: MarkType): InlineMark {
  return { type };
}

export function inlineNodes(block: BlockInput): InlineNode[] {
  if (block.runs && block.runs.length > 0) {
    return block.runs.map((run) => ({
      type: "text",
      text: run.text,
      marks: (run.marks ?? []).map(toMark),
    }));
  }
  const text = block.text ?? "";
  if (text.length === 0) return [];
  return [{ type: "text", text, marks: (block.marks ?? []).map(toMark) }];
}

export function blockText(node: BlockNode): string {
  return (node.content ?? []).map((n) => n.text).join("");
}

export function blocksToText(nodes: BlockNode[]): string {
  return nodes.map(blockText).join("\n\n");
}

/** Split a plain-text blob into paragraph-ish blocks (blank line separated). */
export function textToBlocks(text: string): BlockInput[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => ({ type: "paragraph" as const, text: part }));
}

export function buildBlockNodes(inputs: BlockInput[]): BlockNode[] {
  const nodes: BlockNode[] = inputs.map((input) => ({
    type: input.type ?? "paragraph",
    attrs: input.type === "heading" ? { level: input.level ?? 2 } : {},
    content: inlineNodes(input),
  }));
  return withBlockIds(nodes);
}

export async function chapterBlockRows(chapterId: string) {
  return db
    .select()
    .from(chapterBlocks)
    .where(eq(chapterBlocks.chapterId, chapterId))
    .orderBy(asc(chapterBlocks.position));
}

function docFromRows(rows: { id: string; kind: string; content: InlineNode[] }[]): EditorDoc {
  return {
    type: "doc",
    content: rows.map((row) => ({
      type: (row.kind || "paragraph") as BlockNode["type"],
      attrs: { id: row.id },
      content: row.content ?? [],
    })),
  };
}

/** Recompute the denormalised chapter document from the block rows. */
export async function syncChapterContent(chapterId: string): Promise<{ plainText: string; wordCount: number }> {
  const rows = await chapterBlockRows(chapterId);
  const doc = docFromRows(rows);
  const plainText = blocksToText(doc.content);
  const wordCount = countWords(plainText);
  await db
    .update(chapters)
    .set({ content: doc, plainText, wordCount, updatedAt: new Date() })
    .where(eq(chapters.id, chapterId));
  return { plainText, wordCount };
}

/** Keep story counters in sync with its chapters. */
export async function syncStoryCounts(storyId: string): Promise<{ wordCount: number; chapterCount: number }> {
  const rows = await db
    .select({ wordCount: chapters.wordCount })
    .from(chapters)
    .where(eq(chapters.storyId, storyId));
  const wordCount = rows.reduce((total, row) => total + row.wordCount, 0);
  const chapterCount = rows.length;
  await db
    .update(stories)
    .set({ wordCount, chapterCount, updatedAt: new Date() })
    .where(eq(stories.id, storyId));
  return { wordCount, chapterCount };
}

/**
 * Write structured blocks into a chapter. `replace` swaps the whole chapter
 * body, `append` adds the blocks after the existing ones.
 */
export async function writeChapterBlocks(
  chapterId: string,
  inputs: BlockInput[],
  mode: "replace" | "append",
  authorId: string,
): Promise<{ plainText: string; wordCount: number; blockCount: number }> {
  if (mode === "replace") {
    await db.delete(chapterBlocks).where(eq(chapterBlocks.chapterId, chapterId));
  }

  const existing = await db
    .select({ position: chapterBlocks.position })
    .from(chapterBlocks)
    .where(eq(chapterBlocks.chapterId, chapterId))
    .orderBy(asc(chapterBlocks.position));

  let position = existing.length > 0 ? existing[existing.length - 1].position + 1 : 0;
  const nodes = buildBlockNodes(inputs);

  for (const node of nodes) {
    const id = typeof node.attrs?.id === "string" ? node.attrs.id : undefined;
    await db.insert(chapterBlocks).values({
      ...(id ? { id } : {}),
      chapterId,
      position,
      kind: node.type,
      content: node.content ?? [],
      plainText: blockText(node),
      authorId,
    });
    position += 1;
  }

  const { plainText, wordCount } = await syncChapterContent(chapterId);
  const rows = await chapterBlockRows(chapterId);
  return { plainText, wordCount, blockCount: rows.length };
}
