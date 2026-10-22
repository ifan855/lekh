import { NextResponse } from "next/server";

import { getStoryAccess } from "@lekh/core";
import { chapters, db, ocrJobs, stories } from "@lekh/db";
import { eq } from "drizzle-orm";

import {
  isResponse,
  jobResult,
  jsonError,
  loadJob,
  requireOcrUser,
  toJobView,
  withResult,
} from "../../_shared";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type PatchBody = {
  key?: unknown;
  editedText?: unknown;
  storyId?: unknown;
  chapterId?: unknown;
};

/** One job of the signed-in writer. */
export async function GET(_req: Request, { params }: RouteContext) {
  const viewer = await requireOcrUser();
  if (isResponse(viewer)) return viewer;

  const { id } = await params;
  const job = await loadJob(id, viewer.userId);
  if (!job) return jsonError("Job not found.", 404);

  return NextResponse.json({ job: toJobView(job) });
}

/**
 * Save the writer's corrected text for one image and/or attach the job to a
 * story + chapter.
 */
export async function PATCH(req: Request, { params }: RouteContext) {
  const viewer = await requireOcrUser();
  if (isResponse(viewer)) return viewer;

  const { id } = await params;
  const job = await loadJob(id, viewer.userId);
  if (!job) return jsonError("Job not found.", 404);

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const updates: Partial<{
    storyId: string | null;
    chapterId: string | null;
    results: ReturnType<typeof withResult>;
    status: string;
  }> = {};

  // ---- attach the job to a story / chapter -------------------------------
  const storyId = typeof body.storyId === "string" && body.storyId ? body.storyId : null;
  const chapterId = typeof body.chapterId === "string" && body.chapterId ? body.chapterId : null;

  if (storyId || chapterId) {
    let targetStoryId = storyId;

    if (chapterId) {
      const chapterRows = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
      const chapter = chapterRows[0];
      if (!chapter) return jsonError("Chapter not found.", 404);
      if (targetStoryId && chapter.storyId !== targetStoryId) {
        return jsonError("That chapter does not belong to this story.", 400);
      }
      if (!targetStoryId) targetStoryId = chapter.storyId;
    }

    if (targetStoryId) {
      const storyRows = await db.select().from(stories).where(eq(stories.id, targetStoryId)).limit(1);
      const story = storyRows[0];
      if (!story) return jsonError("Story not found.", 404);
      const access = await getStoryAccess(story, { id: viewer.userId, role: viewer.role });
      if (!access.canEdit) return jsonError("You cannot edit that story.", 403);
      updates.storyId = targetStoryId;
    }

    if (chapterId) updates.chapterId = chapterId;
  }

  // ---- save the corrected text of one image ------------------------------
  if (typeof body.key === "string" && body.key) {
    if (typeof body.editedText !== "string") {
      return jsonError("editedText must be a string.", 400);
    }
    const existing = jobResult(job, body.key);
    if (!existing) return jsonError("That image is not part of this job.", 404);
    updates.results = withResult(job.results ?? [], body.key, {
      editedText: body.editedText,
      status:
        existing.status === "pending" || existing.status === "processing" ? "done" : existing.status,
    });
    if (!updates.status && job.status === "pending") updates.status = "review";
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("Nothing to update.", 400);
  }

  const rows = await db
    .update(ocrJobs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(ocrJobs.id, job.id))
    .returning();

  const updated = rows[0] ?? job;
  return NextResponse.json({ job: toJobView(updated) });
}
