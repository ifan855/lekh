import { eq, sql } from "drizzle-orm";

import { comments, db, stories } from "@lekh/db";

import type { CommentScope } from "@/components/comments/types";

import {
  chapterBelongsToStory,
  chapterIdForBlock,
  DEFAULT_LIMIT,
  listComments,
  MAX_COMMENT_LENGTH,
  MAX_QUOTE_LENGTH,
  MAX_LIMIT,
  parseIntParam,
  resolveAccess,
  toCommentDto,
  viewerPayload,
  type CommentRow,
} from "./_lib";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ *
 * GET /api/comments?storyId=&chapterId=&blockId=&scope=&limit=&offset=
 * ------------------------------------------------------------------ */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const params = url.searchParams;

  const storyId = params.get("storyId");
  if (!storyId) {
    return Response.json({ error: "storyId is required" }, { status: 400 });
  }

  const { viewer, story, allowed } = await resolveAccess(storyId);
  if (!story) {
    return Response.json({ error: "Story not found" }, { status: 404 });
  }
  if (!allowed) {
    return Response.json({ error: "You do not have access to this story" }, { status: 403 });
  }

  const rawScope = params.get("scope");
  const chapterIdParam = params.get("chapterId");
  const blockIdParam = params.get("blockId");

  let chapterId = chapterIdParam;
  const blockId = blockIdParam;

  // Inline comments are anchored to a block; the block is authoritative, so the
  // chapter is derived from it when the caller did not send one.
  if (blockId) {
    chapterId = await chapterIdForBlock(blockId);
  }

  const scope: CommentScope =
    rawScope === "chapter" || rawScope === "inline" || rawScope === "story"
      ? rawScope
      : blockId
        ? "inline"
        : chapterId
          ? "chapter"
          : "story";

  if (scope === "chapter" && !chapterId) {
    return Response.json({ error: "chapterId is required for chapter comments" }, { status: 400 });
  }
  if (scope === "inline" && !blockId) {
    return Response.json(
      { error: "blockId is required for inline comments" },
      { status: 400 },
    );
  }

  const limit = parseIntParam(params.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = parseIntParam(params.get("offset"), 0, 100_000);

  const result = await listComments(storyId, { scope, chapterId, blockId }, limit, offset);

  return Response.json({
    comments: result.comments,
    total: result.total,
    scope,
    limit,
    offset,
    viewer: viewerPayload(viewer),
  });
}

/* ------------------------------------------------------------------ *
 * POST /api/comments
 * body: { storyId, chapterId?, blockId?, quotedText?, parentId?, body }
 * ------------------------------------------------------------------ */
export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const storyId = typeof payload?.storyId === "string" ? payload.storyId.trim() : "";
  const bodyText = typeof payload?.body === "string" ? payload.body.trim() : "";

  if (!storyId) {
    return Response.json({ error: "storyId is required" }, { status: 400 });
  }
  if (!bodyText) {
    return Response.json({ error: "Comment cannot be empty" }, { status: 400 });
  }
  if (bodyText.length > MAX_COMMENT_LENGTH) {
    return Response.json(
      { error: `Comments are limited to ${MAX_COMMENT_LENGTH} characters` },
      { status: 400 },
    );
  }

  const { viewer, story, allowed } = await resolveAccess(storyId);
  if (!viewer) {
    return Response.json({ error: "Sign in to comment" }, { status: 401 });
  }
  if (!story) {
    return Response.json({ error: "Story not found" }, { status: 404 });
  }
  if (!allowed) {
    return Response.json(
      { error: "You cannot comment on this story" },
      { status: 403 },
    );
  }

  const parentId = typeof payload?.parentId === "string" ? payload.parentId.trim() : "";
  const quotedRaw = typeof payload?.quotedText === "string" ? payload.quotedText.trim() : "";

  let chapterId: string | null = typeof payload?.chapterId === "string" ? payload.chapterId.trim() : "";
  let blockId: string | null = typeof payload?.blockId === "string" ? payload.blockId.trim() : "";
  let quotedText: string | null = quotedRaw ? quotedRaw.slice(0, MAX_QUOTE_LENGTH) : null;
  let resolvedParentId: string | null = null;

  if (parentId) {
    const parentRows = await db.select().from(comments).where(eq(comments.id, parentId)).limit(1);
    const parent = parentRows[0];
    if (!parent) {
      return Response.json({ error: "Parent comment not found" }, { status: 404 });
    }
    if (parent.storyId !== storyId) {
      return Response.json({ error: "Parent comment belongs to another story" }, { status: 400 });
    }
    // Replies inherit the anchoring of the comment they answer.
    chapterId = parent.chapterId;
    blockId = parent.blockId;
    quotedText = parent.quotedText;
    // Keep the thread at one level of nesting.
    resolvedParentId = parent.parentId ?? parent.id;
  } else {
    if (blockId) {
      chapterId = await chapterIdForBlock(blockId);
      if (!chapterId) {
        return Response.json({ error: "Block not found" }, { status: 404 });
      }
      const ok = await chapterBelongsToStory(chapterId, storyId);
      if (!ok) {
        return Response.json({ error: "Block not found in this story" }, { status: 404 });
      }
    } else if (chapterId) {
      const ok = await chapterBelongsToStory(chapterId, storyId);
      if (!ok) {
        return Response.json({ error: "Chapter not found in this story" }, { status: 404 });
      }
    }
  }

  const inserted = await db
    .insert(comments)
    .values({
      storyId,
      chapterId: chapterId || null,
      blockId: blockId || null,
      quotedText,
      authorId: viewer.userId,
      parentId: resolvedParentId,
      body: bodyText,
    })
    .returning();

  const row = inserted[0];
  if (!row) {
    return Response.json({ error: "Could not create comment" }, { status: 500 });
  }

  await db
    .update(stories)
    .set({ commentCount: sql`${stories.commentCount} + 1` })
    .where(eq(stories.id, storyId));

  const dto = toCommentDto({
    id: row.id,
    storyId: row.storyId,
    chapterId: row.chapterId,
    blockId: row.blockId,
    quotedText: row.quotedText,
    parentId: row.parentId,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    authorId: row.authorId,
    authorUsername: viewer.username,
    authorDisplayName: viewer.displayName,
    authorAvatarKey: viewer.avatarKey,
  } satisfies CommentRow);

  return Response.json({ comment: dto }, { status: 201 });
}
