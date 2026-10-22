import { NextResponse } from "next/server";

import { repairTranscription } from "@lekh/core";

import {
  fetchImageBase64,
  isResponse,
  jobImage,
  jsonError,
  loadJob,
  requireOcrUser,
  visionConfigOrError,
} from "../../../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

type Body = { key?: unknown; text?: unknown };

/**
 * Re-check a draft transcription against the image and propose corrections.
 *
 * Nothing is persisted here: the writer still has to approve the result.
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
  const currentText = typeof body.text === "string" ? body.text : "";

  if (!jobImage(job, key)) return jsonError("That image is not part of this job.", 404);

  const vision = await visionConfigOrError();
  if (!vision.ok) {
    return jsonError(vision.message, 503, { code: "provider_not_configured" });
  }

  try {
    const payload = await fetchImageBase64(key);
    const result = await repairTranscription(
      { base64: payload.base64, mimeType: payload.mimeType },
      currentText,
      { language: job.language, config: vision.config },
    );
    return NextResponse.json({
      text: result.text,
      blocks: result.blocks,
      notes: result.notes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not fix the text.";
    return jsonError(message, 502, { code: "repair_failed" });
  }
}
