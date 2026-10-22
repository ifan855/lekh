import { countWords, withBlockIds } from "@lekh/core/text";
import type { BlockNode, EditorDoc, InlineNode } from "@lekh/db/schema";

export type EditorBlock = BlockNode & {
  plainText?: string;
  deleted?: boolean;
  updatedAt?: string;
};

/** Convert a TipTap/ProseMirror document into lekh blocks (with stable ids). */
export function docToEditorBlocks(doc: EditorDoc | null | undefined): EditorBlock[] {
  if (!doc?.content) return [];
  const blocks: EditorBlock[] = doc.content.map((node) => ({
    type: node.type === "heading" ? "heading" : node.type === "blockquote" ? "blockquote" : node.type === "hr" ? "hr" : "paragraph",
    attrs: node.attrs ?? {},
    content: (node.content ?? []) as InlineNode[],
    plainText: (node.content ?? []).map((c) => c.text).join(""),
    deleted: false,
  }));
  return withBlockIds(blocks) as EditorBlock[];
}

export function editorBlocksToDoc(blocks: EditorBlock[]): EditorDoc {
  return {
    type: "doc",
    content: blocks
      .filter((b) => !b.deleted)
      .map((b) => ({
        type: b.type,
        attrs: b.attrs ?? {},
        content: b.content ?? [],
      })),
  };
}

export function blocksPlainText(blocks: EditorBlock[]): string {
  return blocks
    .filter((b) => !b.deleted)
    .map((b) => (b.content ?? []).map((c) => c.text).join(""))
    .join("\n\n");
}

export function blocksWordCount(blocks: EditorBlock[]): number {
  return countWords(blocksPlainText(blocks));
}

/** Stable key for a block so the client can diff what changed. */
export function blockSignature(block: EditorBlock): string {
  return JSON.stringify([block.type, block.attrs ?? {}, block.content ?? [], block.deleted ?? false]);
}
