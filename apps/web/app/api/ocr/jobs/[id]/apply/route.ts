import { NextResponse } from "next/server";

import { countWords, docToText, getStoryAccess } from "@lekh/core";
import { chapters, db, ocrJobs, stories } from "@lekh/db";
import type { BlockNode, EditorDoc } from "@lekh/db";
import { eq } from "drizzle-orm";

import {
  isResponse,
  jobResult,
  jsonError,
  loadJob,
  requireOcrUser,
  textToBlocks,
  withResult,
} from "../../../_shared";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type Body = {
  key?: unknown;
  chapterId?: unknown;
  mode?: unknown;
};

export type AppliedChapter = {
  id: string;
  storyId: string;
  title: string;
  position: number;
  content: EditorDoc;
  plainText: string;
  wordCount: number;
  updatedAt: string;
};

/**
 * Insert an approved transcription into a chapter.
 *
 * Nothing is written unless the writer explicitly approved the text first
 * (the approval stores `editedText` on the image result).
 */
export async function POST(req: Request, { params }: RouteContext) {
  const viewer = await requireOcrUser();
  if (isResponse(viewer)) return viewer;

  const { id } = await params;
  const job = await loadJob(id, viewer.userId);
  if (!job) return jsonError("Job not found.", 404);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const key = typeof body.key === "string" ? body.key : "";
  if (!key) return jsonError("key is required.", 400);

  const chapterId = typeof body.chapterId === "string" ? body.chapterId : "";
  if (!chapterId) return jsonError("Choose a chapter to insert the text into.", 400);

  const mode = body.mode === "replace" ? "replace" : "append";

  const result = jobResult(job, key);
  if (!result) return jsonError("That image is not part of this job.", 404);

  // ---- guardrail: the writer must have approved the text ----------------
  if (typeof result.editedText !== "string") {
    return jsonError(
      "Approve the transcription before adding it to the chapter.",
      400,
      { code: "not_approved" },
    );
  }
  const approvedText = result.editedText.trim();
  if (!approvedText) {
    return jsonError("The approved text is empty, so there is nothing to add.", 400);
  }

  // ---- permissions -------------------------------------------------------
  const chapterRows = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  const chapter = chapterRows[0];
  if (!chapter) return jsonError("Chapter not found.", 404);

  const storyRows = await db.select().from(stories).where(eq(stories.id, chapter.storyId)).limit(1);
  const story = storyRows[0];
  if (!story) return jsonError("Story not found.", 404);

  const access = await getStoryAccess(story, { id: viewer.userId, role: viewer.role });
  if (!access.canEdit) return jsonError("You cannot edit that story.", 403);

  // ---- merge the blocks --------------------------------------------------
  const newBlocks: BlockNode[] = textToBlocks(approvedText);
  if (!newBlocks.length) {
    return jsonError("The approved text is empty, so there is nothing to add.", 400);
  }

  const current = chapter.content ?? { type: "doc" as const, content: [] };
  const currentBlocks = Array.isArray(current.content) ? current.content : [];
  const merged: EditorDoc = {
    type: "doc",
    content: mode === "replace" ? newBlocks : [...currentBlocks, ...newBlocks],
  };

  const plainText = docToText(merged);
  const wordCount = countWords(plainText);

  const rows = await db
    .update(chapters)
    .set({ content: merged, plainText, wordCount, updatedAt: new Date() })
    .where(eq(chapters.id, chapter.id))
    .returning();

  const updated = rows[0] ?? chapter;

  // remember where the job was applied
  await db
    .update(ocrJobs)
    .set({
      storyId: chapter.storyId,
      chapterId: chapter.id,
      results: withResult(job.results ?? [], key, { status: "done" }),
      updatedAt: new Date(),
    })
    .where(eq(ocrJobs.id, job.id));

  const payload: AppliedChapter = {
    id: updated.id,
    storyId: updated.storyId,
    title: updated.title,
    position: updated.position,
    content: updated.content,
    plainText: updated.plainText,
    wordCount: updated.wordCount,
    updatedAt: updated.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };

  return NextResponse.json({ chapter: payload, inserted: newBlocks.length });
}
