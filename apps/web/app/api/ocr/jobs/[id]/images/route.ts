import { NextResponse } from "next/server";

import { transcribeImage } from "@lekh/core";
import { db, ocrJobs } from "@lekh/db";
import { eq } from "drizzle-orm";

import {
  fetchImageBase64,
  isResponse,
  jobImage,
  jsonError,
  loadJob,
  requireOcrUser,
  toJobView,
  visionConfigOrError,
  withResult,
} from "../../../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

type Body = { key?: unknown; name?: unknown };

/**
 * Transcribe one already uploaded image.
 *
 * The client has PUT the bytes straight to storage, so the request body stays
 * tiny no matter how big the scan is.
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

  const image = jobImage(job, key);
  if (!image) return jsonError("That image is not part of this job.", 404);

  const vision = await visionConfigOrError();
  if (!vision.ok) {
    await failJob(job.id, key, vision.message);
    return jsonError(vision.message, 503, { code: "provider_not_configured" });
  }

  // mark as processing
  await db
    .update(ocrJobs)
    .set({
      status: "running",
      provider: vision.config.provider,
      model: vision.config.model ?? null,
      results: withResult(job.results ?? [], key, { status: "processing" }),
      updatedAt: new Date(),
    })
    .where(eq(ocrJobs.id, job.id));

  try {
    const payload = await fetchImageBase64(key);
    const result = await transcribeImage(
      { base64: payload.base64, mimeType: payload.mimeType },
      { language: job.language, config: vision.config },
    );

    const results = withResult(job.results ?? [], key, {
      status: "done",
      text: result.text,
      blocks: result.blocks,
      confidence: result.confidence,
    });

    const rows = await db
      .update(ocrJobs)
      .set({
        status: "review",
        provider: vision.config.provider,
        model: vision.config.model ?? null,
        results,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(ocrJobs.id, job.id))
      .returning();

    const updated = rows[0] ?? job;
    const imageResult = (updated.results ?? []).find((r) => r.imageKey === key) ?? null;
    return NextResponse.json({ result: imageResult, job: toJobView(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";
    await failJob(job.id, key, message);
    return jsonError(message, 502, { code: "transcription_failed" });
  }
}

async function failJob(jobId: string, key: string, message: string) {
  const rows = await db.select().from(ocrJobs).where(eq(ocrJobs.id, jobId)).limit(1);
  const job = rows[0];
  if (!job) return;
  await db
    .update(ocrJobs)
    .set({
      status: "failed",
      error: message,
      results: withResult(job.results ?? [], key, { status: "error", error: message }),
      updatedAt: new Date(),
    })
    .where(eq(ocrJobs.id, jobId));
}
