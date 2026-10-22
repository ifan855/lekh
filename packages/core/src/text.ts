import type { BlockNode, EditorDoc, InlineNode } from "@lekh/db";

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // Count CJK characters individually, latin words by whitespace.
  const cjk = trimmed.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/g)?.length ?? 0;
  const latin = trimmed
    .replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + latin;
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\u0400-\u04ff\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "story"
  );
}

export function blocksToDoc(blocks: BlockNode[]): EditorDoc {
  return {
    type: "doc",
    content: blocks.map((b) => ({
      type: b.type,
      attrs: b.attrs ?? {},
      content: b.content ?? [],
    })),
  };
}

export function docToBlocks(doc: EditorDoc | null | undefined): BlockNode[] {
  if (!doc?.content) return [];
  return doc.content.map((b) => ({
    type: b.type,
    attrs: b.attrs ?? {},
    content: b.content ?? [],
  }));
}

export function blockText(block: BlockNode): string {
  return (block.content ?? []).map((n) => n.text).join("");
}

export function docToText(doc: EditorDoc | null | undefined): string {
  return docToBlocks(doc)
    .map((b) => {
      const text = blockText(b);
      if (b.type === "heading") return `## ${text}`;
      return text;
    })
    .join("\n\n");
}

export function blocksToPlainText(blocks: BlockNode[]): string {
  return blocks.map(blockText).join("\n\n");
}

export function emptyDoc(): EditorDoc {
  return { type: "doc", content: [{ type: "paragraph", content: [] }] };
}

/** Ensure every block carries a stable id (used by comments + realtime). */
export function withBlockIds(blocks: BlockNode[], existingIds: string[] = []): BlockNode[] {
  const used = new Set(existingIds);
  return blocks.map((b) => {
    const attrs = { ...(b.attrs ?? {}) };
    if (!attrs.id || used.has(attrs.id)) {
      let id = crypto.randomUUID();
      while (used.has(id)) id = crypto.randomUUID();
      used.add(id);
      attrs.id = id;
    } else {
      used.add(attrs.id);
    }
    return { ...b, attrs };
  });
}

export function inlineToText(nodes: InlineNode[] | undefined): string {
  return (nodes ?? []).map((n) => n.text).join("");
}

/** Markdown export of an editor document. */
export function docToMarkdown(doc: EditorDoc | null | undefined): string {
  return docToBlocks(doc)
    .map((b) => {
      const text = (b.content ?? [])
        .map((n) => {
          let value = n.text;
          for (const mark of n.marks ?? []) {
            if (mark.type === "bold") value = `**${value}**`;
            else if (mark.type === "italic") value = `*${value}*`;
            else if (mark.type === "strike") value = `~~${value}~~`;
            else if (mark.type === "code") value = `\`${value}\``;
            else if (mark.type === "highlight") value = `==${value}==`;
          }
          return value;
        })
        .join("");
      if (b.type === "heading") return `${"#".repeat((b.attrs?.level as number) ?? 2)} ${text}`;
      if (b.type === "blockquote") return `> ${text}`;
      if (b.type === "hr") return "---";
      return text;
    })
    .join("\n\n");
}
