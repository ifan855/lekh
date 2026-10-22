import { docToMarkdown, docToText, getStoryBundle } from "@lekh/core";
import { db, chapterBlocks, chapters, parts, stories, storyEditors } from "@lekh/db";
import { and, asc, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { z } from "zod";

import { requireChapter, requireStory, storySummary } from "../lib/access.js";
import { text, textResult, type ToolContext, type ToolResult } from "../types.js";
import { defineTool, type ToolDef } from "./define.js";

const listStories = defineTool({
  name: "list_stories",
  scope: "read",
  description:
    "List the stories the authenticated user owns or co-writes. Returns id, title, slug, status, visibility, language, wordCount, chapterCount, tags and updatedAt. Filter with `query` (title/description match) and `status` (draft|published).",
  schema: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    query: z.string().min(1).optional(),
    status: z.enum(["draft", "published"]).optional(),
  }),
  handler: async (args, ctx) => {
    const owned = await db
      .select({ id: stories.id })
      .from(stories)
      .where(eq(stories.authorId, ctx.viewer.id));
    const shared = await db
      .select({ id: storyEditors.storyId })
      .from(storyEditors)
      .where(eq(storyEditors.userId, ctx.viewer.id));

    const ownedIds = new Set(owned.map((row) => row.id));
    const ids = [...ownedIds, ...shared.map((row) => row.id).filter((id) => !ownedIds.has(id))];
    if (ids.length === 0) return text("No stories yet. Use create_story to start one.");

    const conditions: SQL[] = [inArray(stories.id, ids)];
    if (args.status) conditions.push(eq(stories.status, args.status));
    if (args.query) {
      const q = `%${args.query.trim()}%`;
      const titleMatch = ilike(stories.title, q);
      const descriptionMatch = ilike(stories.description, q);
      conditions.push(or(titleMatch, descriptionMatch) ?? titleMatch);
    }

    const rows = await db
      .select()
      .from(stories)
      .where(and(...conditions))
      .orderBy(desc(stories.updatedAt))
      .limit(args.limit ?? 25);

    return textResult(
      rows.map((story) => ({
        ...storySummary(story),
        relation: ownedIds.has(story.id) ? "owner" : "co-author",
      })),
    );
  },
});

const getStory = defineTool({
  name: "get_story",
  scope: "read",
  description:
    "Get a story's metadata together with its parts and a chapter outline (chapter ids, titles, positions, word counts). Use the chapter ids with get_chapter or get_draft to read the prose.",
  schema: z.object({ storyId: z.string().uuid() }),
  handler: async (args, ctx) => {
    const { story } = await requireStory(ctx, args.storyId, "view");
    const bundle = await getStoryBundle(args.storyId);
    if (!bundle) throw new Error(`Story ${args.storyId} was not found.`);

    return textResult({
      story: {
        ...storySummary(story),
        publishedAt: story.publishedAt,
        createdAt: story.createdAt,
        readCount: story.readCount,
        commentCount: story.commentCount,
      },
      parts: bundle.parts.map((part) => ({
        id: part.id,
        title: part.title,
        position: part.position,
      })),
      chapters: bundle.chapters.map((chapter) => ({
        id: chapter.id,
        partId: chapter.partId,
        title: chapter.title,
        position: chapter.position,
        wordCount: chapter.wordCount,
        updatedAt: chapter.updatedAt,
      })),
    });
  },
});

const getChapter = defineTool({
  name: "get_chapter",
  scope: "read",
  description:
    "Read one chapter in full: title, position, plainText, the ProseMirror content JSON and the word count.",
  schema: z.object({ chapterId: z.string().uuid() }),
  handler: async (args, ctx) => {
    const { chapter } = await requireChapter(ctx, args.chapterId, "view");
    return textResult({
      id: chapter.id,
      storyId: chapter.storyId,
      partId: chapter.partId,
      title: chapter.title,
      position: chapter.position,
      wordCount: chapter.wordCount,
      isLocked: chapter.isLocked,
      plainText: chapter.plainText,
      content: chapter.content,
      updatedAt: chapter.updatedAt,
    });
  },
});

const getDraft = defineTool({
  name: "get_draft",
  scope: "read",
  description:
    "Get a compact outline of a whole story: its parts, its chapters and the first paragraph of every chapter. Use this to plan what to write next.",
  schema: z.object({ storyId: z.string().uuid() }),
  handler: async (args, ctx) => {
    await requireStory(ctx, args.storyId, "view");

    const partRows = await db
      .select()
      .from(parts)
      .where(eq(parts.storyId, args.storyId))
      .orderBy(asc(parts.position));
    const chapterRows = await db
      .select()
      .from(chapters)
      .where(eq(chapters.storyId, args.storyId))
      .orderBy(asc(chapters.position));

    const chapterIds = chapterRows.map((row) => row.id);
    const blockRows = chapterIds.length
      ? await db
          .select()
          .from(chapterBlocks)
          .where(inArray(chapterBlocks.chapterId, chapterIds))
          .orderBy(asc(chapterBlocks.position))
      : [];

    const firstParagraph = new Map<string, string>();
    for (const row of blockRows) {
      if (!firstParagraph.has(row.chapterId)) firstParagraph.set(row.chapterId, row.plainText);
    }

    return textResult({
      storyId: args.storyId,
      parts: partRows.map((part) => ({ id: part.id, title: part.title, position: part.position })),
      chapters: chapterRows.map((chapter) => ({
        id: chapter.id,
        partId: chapter.partId,
        title: chapter.title,
        position: chapter.position,
        wordCount: chapter.wordCount,
        firstParagraph: firstParagraph.get(chapter.id) ?? "",
      })),
    });
  },
});

const searchContent = defineTool({
  name: "search_content",
  scope: "read",
  description:
    "Search the prose of one story. Returns the matching chapters (id, title, position) with a short snippet around the match.",
  schema: z.object({
    storyId: z.string().uuid(),
    query: z.string().min(1),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  handler: async (args) => {
    const q = `%${args.query.trim()}%`;
    const rows = await db
      .select({
        id: chapters.id,
        title: chapters.title,
        position: chapters.position,
        plainText: chapters.plainText,
      })
      .from(chapters)
      .where(and(eq(chapters.storyId, args.storyId), ilike(chapters.plainText, q)))
      .orderBy(asc(chapters.position))
      .limit(args.limit ?? 10);

    return textResult(
      rows.map((row) => {
        const index = row.plainText.toLowerCase().indexOf(args.query.trim().toLowerCase());
        const start = Math.max(0, index - 80);
        const end = Math.min(row.plainText.length, index + args.query.trim().length + 80);
        return {
          id: row.id,
          title: row.title,
          position: row.position,
          snippet: `${start > 0 ? "…" : ""}${row.plainText.slice(start, end)}${end < row.plainText.length ? "…" : ""}`,
        };
      }),
    );
  },
});

const exportChapter = defineTool({
  name: "export_chapter",
  scope: "read",
  description:
    "Export a chapter as plain text (format: text) or Markdown (format: markdown). Markdown keeps headings, block quotes and bold/italic marks.",
  schema: z.object({
    chapterId: z.string().uuid(),
    format: z.enum(["text", "markdown"]).optional(),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    const { chapter } = await requireChapter(ctx, args.chapterId, "view");
    const format = args.format ?? "text";
    const body = format === "markdown" ? docToMarkdown(chapter.content) : docToText(chapter.content);
    return text(body || chapter.plainText);
  },
});

export const readTools: ToolDef[] = [
  listStories,
  getStory,
  getChapter,
  getDraft,
  searchContent,
  exportChapter,
];
