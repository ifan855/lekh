import { db, chapters, parts, stories } from "@lekh/db";
import { eq, max } from "drizzle-orm";
import { z } from "zod";

import {
  requireChapter,
  requirePart,
  requireStory,
  storySummary,
  uniqueSlug,
} from "../lib/access.js";
import {
  syncStoryCounts,
  textToBlocks,
  writeChapterBlocks,
  type BlockInput,
} from "../lib/content.js";
import { text, textResult } from "../types.js";
import { defineTool, type ToolDef } from "./define.js";

const markSchema = z.enum(["bold", "italic", "underline", "strike", "code", "highlight"]);

const blockSchema = z.object({
  type: z.enum(["paragraph", "heading", "blockquote"]).optional(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  text: z.string().optional(),
  marks: z.array(markSchema).optional(),
  runs: z
    .array(z.object({ text: z.string(), marks: z.array(markSchema).optional() }))
    .optional(),
});

const contentSchema = z.union([z.string(), z.array(blockSchema)]);

function toBlockInputs(content: string | z.infer<typeof blockSchema>[]): BlockInput[] {
  if (typeof content === "string") return textToBlocks(content);
  return content.map((block) => ({
    type: block.type,
    level: block.level,
    text: block.text,
    marks: block.marks,
    runs: block.runs,
  }));
}

const createStory = defineTool({
  name: "create_story",
  scope: "write",
  description:
    "Create a new (draft) story owned by the authenticated user. Returns the story with its id, slug and status. Chapters are added afterwards with create_chapter / write_blocks.",
  schema: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    language: z.string().min(2).max(10).optional(),
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
    visibility: z.enum(["public", "unlisted", "private"]).optional(),
    fontPreset: z.string().min(1).max(40).optional(),
  }),
  handler: async (args, ctx) => {
    const slug = await uniqueSlug(ctx.viewer.id, args.title);
    const rows = await db
      .insert(stories)
      .values({
        authorId: ctx.viewer.id,
        title: args.title,
        slug,
        description: args.description ?? "",
        language: args.language ?? "en",
        tags: args.tags ?? [],
        visibility: args.visibility ?? "public",
        fontPreset: args.fontPreset ?? "literary",
        status: "draft",
      })
      .returning();
    return textResult(storySummary(rows[0]));
  },
});

const updateStory = defineTool({
  name: "update_story",
  scope: "write",
  description:
    "Update a story's metadata: title, description, tags, visibility, status (draft|published), language, fontPreset or the completed flag. Only the owner, co-authors and admins can update a story.",
  schema: z.object({
    storyId: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
    visibility: z.enum(["public", "unlisted", "private"]).optional(),
    status: z.enum(["draft", "published"]).optional(),
    language: z.string().min(2).max(10).optional(),
    fontPreset: z.string().min(1).max(40).optional(),
    isCompleted: z.boolean().optional(),
  }),
  handler: async (args, ctx) => {
    const { story } = await requireStory(ctx, args.storyId, "edit");
    const patch: Partial<typeof stories.$inferInsert> = { updatedAt: new Date() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.tags !== undefined) patch.tags = args.tags;
    if (args.visibility !== undefined) patch.visibility = args.visibility;
    if (args.language !== undefined) patch.language = args.language;
    if (args.fontPreset !== undefined) patch.fontPreset = args.fontPreset;
    if (args.isCompleted !== undefined) patch.isCompleted = args.isCompleted;
    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "published" && !story.publishedAt) patch.publishedAt = new Date();
    }

    const rows = await db
      .update(stories)
      .set(patch)
      .where(eq(stories.id, args.storyId))
      .returning();
    return textResult(storySummary(rows[0]));
  },
});

const deleteStory = defineTool({
  name: "delete_story",
  scope: "write",
  description:
    "Delete a story with all of its parts, chapters and blocks. Only the owner or an admin may delete a story. This cannot be undone.",
  schema: z.object({ storyId: z.string().uuid() }),
  handler: async (args, ctx) => {
    const { story, isOwner } = await requireStory(ctx, args.storyId, "edit");
    if (!isOwner && ctx.viewer.role !== "admin") {
      throw new Error("Only the story owner (or an admin) can delete a story.");
    }
    await db.delete(stories).where(eq(stories.id, story.id));
    return text(`Deleted story "${story.title}" (${story.id}).`);
  },
});

const createPart = defineTool({
  name: "create_part",
  scope: "write",
  description:
    "Add a part (an optional grouping such as 'Act One') to a story. Parts hold chapters; `position` defaults to the end of the list.",
  schema: z.object({
    storyId: z.string().uuid(),
    title: z.string().max(200).optional(),
    position: z.number().int().min(0).optional(),
  }),
  handler: async (args, ctx) => {
    await requireStory(ctx, args.storyId, "edit");
    let position = args.position;
    if (position === undefined) {
      const rows = await db
        .select({ value: max(parts.position) })
        .from(parts)
        .where(eq(parts.storyId, args.storyId));
      position = (rows[0]?.value ?? -1) + 1;
    }
    const rows = await db
      .insert(parts)
      .values({ storyId: args.storyId, title: args.title ?? "", position })
      .returning();
    return textResult({
      id: rows[0].id,
      storyId: rows[0].storyId,
      title: rows[0].title,
      position: rows[0].position,
    });
  },
});

const updatePart = defineTool({
  name: "update_part",
  scope: "write",
  description: "Rename a part or move it to another position in the story.",
  schema: z.object({
    partId: z.string().uuid(),
    title: z.string().max(200).optional(),
    position: z.number().int().min(0).optional(),
  }),
  handler: async (args, ctx) => {
    const { part } = await requirePart(ctx, args.partId, "edit");
    const patch: Partial<typeof parts.$inferInsert> = { updatedAt: new Date() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.position !== undefined) patch.position = args.position;
    const rows = await db.update(parts).set(patch).where(eq(parts.id, part.id)).returning();
    return textResult({
      id: rows[0].id,
      storyId: rows[0].storyId,
      title: rows[0].title,
      position: rows[0].position,
    });
  },
});

const deletePart = defineTool({
  name: "delete_part",
  scope: "write",
  description:
    "Delete a part. Its chapters stay in the story but lose their part assignment.",
  schema: z.object({ partId: z.string().uuid() }),
  handler: async (args, ctx) => {
    const { part } = await requirePart(ctx, args.partId, "edit");
    await db.delete(parts).where(eq(parts.id, part.id));
    return text(`Deleted part ${part.id} ("${part.title}").`);
  },
});

const createChapter = defineTool({
  name: "create_chapter",
  scope: "write",
  description:
    "Create a chapter in a story, optionally inside a part, with optional starting content. `content` is either plain text (blank line separated paragraphs) or an array of blocks. The chapter, its blocks and the story counters are all updated.",
  schema: z.object({
    storyId: z.string().uuid(),
    partId: z.string().uuid().optional(),
    title: z.string().max(200).optional(),
    content: contentSchema.optional(),
    position: z.number().int().min(0).optional(),
  }),
  handler: async (args, ctx) => {
    await requireStory(ctx, args.storyId, "edit");
    if (args.partId) {
      const partRows = await db.select().from(parts).where(eq(parts.id, args.partId)).limit(1);
      if (!partRows[0]) throw new Error(`Part ${args.partId} was not found.`);
      if (partRows[0].storyId !== args.storyId) {
        throw new Error(`Part ${args.partId} belongs to a different story.`);
      }
    }

    let position = args.position;
    if (position === undefined) {
      const rows = await db
        .select({ value: max(chapters.position) })
        .from(chapters)
        .where(eq(chapters.storyId, args.storyId));
      position = (rows[0]?.value ?? -1) + 1;
    }

    const rows = await db
      .insert(chapters)
      .values({
        storyId: args.storyId,
        partId: args.partId ?? null,
        title: args.title ?? "",
        position,
      })
      .returning();
    const chapter = rows[0];

    let wordCount = 0;
    if (args.content !== undefined) {
      const written = await writeChapterBlocks(
        chapter.id,
        toBlockInputs(args.content),
        "replace",
        ctx.viewer.id,
      );
      wordCount = written.wordCount;
    }
    await syncStoryCounts(args.storyId);

    return textResult({
      id: chapter.id,
      storyId: chapter.storyId,
      partId: chapter.partId,
      title: chapter.title,
      position: chapter.position,
      wordCount,
    });
  },
});

const updateChapter = defineTool({
  name: "update_chapter",
  scope: "write",
  description:
    "Edit a chapter: rename it, move it, move it to another part, rewrite its body or append to it. `content` is plain text or an array of blocks; `mode` is 'replace' (default) or 'append'. `appendText` always appends.",
  schema: z.object({
    chapterId: z.string().uuid(),
    title: z.string().max(200).optional(),
    position: z.number().int().min(0).optional(),
    partId: z.string().uuid().nullable().optional(),
    content: contentSchema.optional(),
    appendText: z.string().optional(),
    mode: z.enum(["replace", "append"]).optional(),
  }),
  handler: async (args, ctx) => {
    const { chapter } = await requireChapter(ctx, args.chapterId, "edit");
    const patch: Partial<typeof chapters.$inferInsert> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.position !== undefined) patch.position = args.position;
    if (args.partId !== undefined) {
      if (args.partId) {
        const partRows = await db.select().from(parts).where(eq(parts.id, args.partId)).limit(1);
        if (!partRows[0]) throw new Error(`Part ${args.partId} was not found.`);
        if (partRows[0].storyId !== chapter.storyId) {
          throw new Error(`Part ${args.partId} belongs to a different story.`);
        }
      }
      patch.partId = args.partId;
    }

    if (Object.keys(patch).length > 0) {
      await db
        .update(chapters)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(chapters.id, chapter.id));
    }

    let written: { wordCount: number } | null = null;
    if (args.content !== undefined) {
      const mode = args.mode ?? "replace";
      written = await writeChapterBlocks(
        chapter.id,
        toBlockInputs(args.content),
        mode,
        ctx.viewer.id,
      );
    }
    if (args.appendText !== undefined) {
      written = await writeChapterBlocks(
        chapter.id,
        textToBlocks(args.appendText),
        "append",
        ctx.viewer.id,
      );
    }
    await syncStoryCounts(chapter.storyId);

    const fresh = await db.select().from(chapters).where(eq(chapters.id, chapter.id)).limit(1);
    return textResult({
      id: chapter.id,
      storyId: chapter.storyId,
      partId: chapter.partId,
      title: fresh[0].title,
      position: fresh[0].position,
      wordCount: written?.wordCount ?? fresh[0].wordCount,
    });
  },
});

const deleteChapter = defineTool({
  name: "delete_chapter",
  scope: "write",
  description: "Delete a chapter and its blocks. The story counters are updated automatically.",
  schema: z.object({ chapterId: z.string().uuid() }),
  handler: async (args, ctx) => {
    const { chapter } = await requireChapter(ctx, args.chapterId, "edit");
    await db.delete(chapters).where(eq(chapters.id, chapter.id));
    await syncStoryCounts(chapter.storyId);
    return text(`Deleted chapter ${chapter.id} ("${chapter.title}").`);
  },
});

const writeBlocks = defineTool({
  name: "write_blocks",
  scope: "write",
  description:
    "Write structured prose blocks into a chapter. This is the main way to write a story: each block is a paragraph, heading or blockquote with optional inline marks (bold, italic, underline, strike, code, highlight), either as `text` + `marks` or as `runs`. mode: 'replace' (default, overwrites the chapter) or 'append'.",
  schema: z.object({
    chapterId: z.string().uuid(),
    blocks: z.array(blockSchema).min(1),
    mode: z.enum(["replace", "append"]).optional(),
  }),
  handler: async (args, ctx) => {
    const { chapter } = await requireChapter(ctx, args.chapterId, "edit");
    const written = await writeChapterBlocks(
      chapter.id,
      toBlockInputs(args.blocks),
      args.mode ?? "replace",
      ctx.viewer.id,
    );
    await syncStoryCounts(chapter.storyId);
    return textResult({
      chapterId: chapter.id,
      mode: args.mode ?? "replace",
      blockCount: written.blockCount,
      wordCount: written.wordCount,
      plainText: written.plainText,
    });
  },
});

const publishStory = defineTool({
  name: "publish_story",
  scope: "write",
  description:
    "Publish a story: sets its status to 'published' and stamps the publication date. The story becomes visible according to its visibility setting.",
  schema: z.object({ storyId: z.string().uuid() }),
  handler: async (args, ctx) => {
    const { story } = await requireStory(ctx, args.storyId, "edit");
    const rows = await db
      .update(stories)
      .set({
        status: "published",
        publishedAt: story.publishedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(stories.id, story.id))
      .returning();
    return textResult(storySummary(rows[0]));
  },
});

const unpublishStory = defineTool({
  name: "unpublish_story",
  scope: "write",
  description: "Unpublish a story: sets its status back to 'draft' so it disappears from the public feed.",
  schema: z.object({ storyId: z.string().uuid() }),
  handler: async (args, ctx) => {
    const { story } = await requireStory(ctx, args.storyId, "edit");
    const rows = await db
      .update(stories)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(stories.id, story.id))
      .returning();
    return textResult(storySummary(rows[0]));
  },
});

export const writeTools: ToolDef[] = [
  createStory,
  updateStory,
  deleteStory,
  createPart,
  updatePart,
  deletePart,
  createChapter,
  updateChapter,
  deleteChapter,
  writeBlocks,
  publishStory,
  unpublishStory,
];
