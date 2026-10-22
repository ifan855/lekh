import { docToText } from "@lekh/core";
import { z } from "zod";

import { requireChapter, requireStory } from "../lib/access.js";
import { syncStoryCounts, textToBlocks, writeChapterBlocks, type BlockInput } from "../lib/content.js";
import {
  closeSession,
  getSession,
  insertSession,
  listSessions,
  setSessionCursor,
  type McpSessionRow,
} from "../lib/mcpSessions.js";
import { textResult, type ToolContext } from "../types.js";
import { defineTool, type ToolDef } from "./define.js";

const markSchema = z.enum(["bold", "italic", "underline", "strike", "code", "highlight"]);

const blockSchema = z.object({
  type: z.enum(["paragraph", "heading", "blockquote"]).optional(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  text: z.string().optional(),
  marks: z.array(markSchema).optional(),
  runs: z.array(z.object({ text: z.string(), marks: z.array(markSchema).optional() })).optional(),
});

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function editorUrl(storyId: string, chapterId: string): string {
  return `${appUrl()}/write/${storyId}/${chapterId}`;
}

function websocketUrl(storyId: string, chapterId: string): string | undefined {
  const realtime = process.env.NEON_REALTIME_URL;
  if (!realtime) return undefined;
  const base = realtime.replace(/\/+$/, "").replace(/^http/, "ws");
  return `${base}/realtime?storyId=${encodeURIComponent(storyId)}&chapterId=${encodeURIComponent(chapterId)}`;
}

function sessionSummary(row: McpSessionRow) {
  return {
    sessionId: row.id,
    storyId: row.story_id,
    chapterId: row.chapter_id,
    status: row.status,
    cursor: row.cursor,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireOwnSession(ctx: ToolContext, sessionId: string) {
  const row = await getSession(sessionId);
  if (!row) throw new Error(`Session ${sessionId} was not found.`);
  if (row.user_id !== ctx.viewer.id && ctx.viewer.role !== "admin") {
    throw new Error(`Session ${sessionId} belongs to another user.`);
  }
  return row;
}

const openSession = defineTool({
  name: "open_session",
  scope: "write",
  description:
    "Open an editing session for a chapter so an agent can write while the author works in the browser. Returns the session id plus the editorUrl (and a websocketUrl when realtime is configured). The session is bound to you and to that chapter.",
  schema: z.object({
    storyId: z.string().uuid(),
    chapterId: z.string().uuid(),
  }),
  handler: async (args, ctx) => {
    await requireStory(ctx, args.storyId, "edit");
    const { chapter } = await requireChapter(ctx, args.chapterId, "edit");
    if (chapter.storyId !== args.storyId) {
      throw new Error(`Chapter ${args.chapterId} does not belong to story ${args.storyId}.`);
    }

    const row = await insertSession({
      userId: ctx.viewer.id,
      storyId: args.storyId,
      chapterId: args.chapterId,
    });

    const ws = websocketUrl(args.storyId, args.chapterId);
    return textResult({
      sessionId: row.id,
      editorUrl: editorUrl(args.storyId, args.chapterId),
      ...(ws ? { websocketUrl: ws } : {}),
      storyId: row.story_id,
      chapterId: row.chapter_id,
      status: row.status,
      createdAt: row.created_at,
    });
  },
});

const closeSessionTool = defineTool({
  name: "close_session",
  scope: "write",
  description: "Close an editing session. The chapter and its text are untouched.",
  schema: z.object({ sessionId: z.string().uuid() }),
  handler: async (args, ctx) => {
    await requireOwnSession(ctx, args.sessionId);
    const row = await closeSession(args.sessionId, ctx.viewer.id);
    if (!row) throw new Error(`Session ${args.sessionId} was not found.`);
    return textResult(sessionSummary(row));
  },
});

const listSessionsTool = defineTool({
  name: "list_sessions",
  scope: "write",
  description:
    "List the editing sessions you opened (optionally filtered by status 'open' or 'closed').",
  schema: z.object({
    status: z.enum(["open", "closed"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  handler: async (args, ctx) => {
    const rows = await listSessions(ctx.viewer.id, {
      status: args.status,
      limit: args.limit,
    });
    return textResult(rows.map(sessionSummary));
  },
});

const sessionStatus = defineTool({
  name: "session_status",
  scope: "write",
  description:
    "Show one editing session: its chapter, its status (open|closed), the last cursor position and when it was created/updated.",
  schema: z.object({ sessionId: z.string().uuid() }),
  handler: async (args, ctx) => {
    const row = await requireOwnSession(ctx, args.sessionId);
    return textResult({
      ...sessionSummary(row),
      editorUrl: editorUrl(row.story_id, row.chapter_id),
    });
  },
});

const sessionRead = defineTool({
  name: "session_read",
  scope: "write",
  description:
    "Read the chapter a session is bound to: title, plain text, blocks and word count. Use this to see what the author has typed since the last write.",
  schema: z.object({ sessionId: z.string().uuid() }),
  handler: async (args, ctx) => {
    const row = await requireOwnSession(ctx, args.sessionId);
    const { chapter } = await requireChapter(ctx, row.chapter_id, "view");
    return textResult({
      sessionId: row.id,
      chapterId: chapter.id,
      storyId: chapter.storyId,
      title: chapter.title,
      position: chapter.position,
      wordCount: chapter.wordCount,
      plainText: chapter.plainText,
      text: docToText(chapter.content),
      updatedAt: chapter.updatedAt,
    });
  },
});

const sessionWrite = defineTool({
  name: "session_write",
  scope: "write",
  description:
    "Write into the chapter a session is bound to. Provide `blocks` (paragraphs/headings with inline marks) to replace the body, or `appendText` to add to the end. Same permission rules as write_blocks.",
  schema: z.object({
    sessionId: z.string().uuid(),
    blocks: z.array(blockSchema).optional(),
    appendText: z.string().optional(),
  }),
  handler: async (args, ctx) => {
    const row = await requireOwnSession(ctx, args.sessionId);
    const { chapter } = await requireChapter(ctx, row.chapter_id, "edit");

    const inputs: BlockInput[] = [];
    if (args.blocks) {
      for (const block of args.blocks) {
        inputs.push({
          type: block.type,
          level: block.level,
          text: block.text,
          marks: block.marks,
          runs: block.runs,
        });
      }
    }
    if (args.appendText) inputs.push(...textToBlocks(args.appendText));
    if (inputs.length === 0) {
      throw new Error("Provide `blocks` or `appendText` to write into the session.");
    }

    const written = await writeChapterBlocks(chapter.id, inputs, args.blocks ? "replace" : "append", ctx.viewer.id);
    await syncStoryCounts(chapter.storyId);

    return textResult({
      sessionId: row.id,
      chapterId: chapter.id,
      blockCount: written.blockCount,
      wordCount: written.wordCount,
      plainText: written.plainText,
    });
  },
});

const sessionCursor = defineTool({
  name: "session_cursor",
  scope: "write",
  description:
    "Record where the agent is writing inside the session's chapter: the block id and the character offset.",
  schema: z.object({
    sessionId: z.string().uuid(),
    blockId: z.string().optional(),
    offset: z.number().int().min(0).optional(),
  }),
  handler: async (args, ctx) => {
    await requireOwnSession(ctx, args.sessionId);
    const row = await setSessionCursor(args.sessionId, ctx.viewer.id, {
      blockId: args.blockId,
      offset: args.offset,
      at: new Date().toISOString(),
    });
    if (!row) throw new Error(`Session ${args.sessionId} was not found.`);
    return textResult(sessionSummary(row));
  },
});

export const sessionTools: ToolDef[] = [
  openSession,
  closeSessionTool,
  listSessionsTool,
  sessionStatus,
  sessionRead,
  sessionWrite,
  sessionCursor,
];
