import { NextResponse } from "next/server";

import { db, ocrJobs } from "@lekh/db";
import { desc, eq } from "drizzle-orm";

import {
  isImageContentType,
  isResponse,
  jsonError,
  normaliseLanguage,
  OCR_MAX_IMAGES,
  prepareUpload,
  publicUrlForKey,
  requireOcrUser,
  sanitiseName,
  toJobView,
} from "../_shared";

export const dynamic = "force-dynamic";

type CreateBody = {
  storyId?: unknown;
  chapterId?: unknown;
  language?: unknown;
  images?: unknown;
};

type ImageInput = { name: string; contentType: string };

function parseImages(value: unknown): ImageInput[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > OCR_MAX_IMAGES) return null;
  const out: ImageInput[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const raw = entry as { name?: unknown; contentType?: unknown };
    const contentType =
      typeof raw.contentType === "string" && raw.contentType.trim()
        ? raw.contentType.trim()
        : "image/jpeg";
    if (!isImageContentType(contentType)) return null;
    out.push({ name: sanitiseName(raw.name), contentType });
  }
  return out;
}

/** Create a job and hand back presigned upload urls for every image. */
export async function POST(req: Request) {
  const viewer = await requireOcrUser();
  if (isResponse(viewer)) return viewer;

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const images = parseImages(body.images);
  if (!images) {
    return jsonError(
      `Pick between 1 and ${OCR_MAX_IMAGES} images (PNG, JPEG, WebP, …) to transcribe.`,
      400,
    );
  }

  const storyId = typeof body.storyId === "string" && body.storyId ? body.storyId : null;
  const chapterId = typeof body.chapterId === "string" && body.chapterId ? body.chapterId : null;
  const language = normaliseLanguage(body.language);

  let prepared: { key: string; name: string; contentType: string; url: string }[];
  try {
    prepared = await Promise.all(
      images.map((img) => prepareUpload(viewer.userId, img.name, img.contentType)),
    );
  } catch {
    return jsonError(
      "Image storage is not available right now. Ask an admin to check the storage configuration.",
      503,
    );
  }

  const rows = await db
    .insert(ocrJobs)
    .values({
      userId: viewer.userId,
      storyId,
      chapterId,
      status: "pending",
      language,
      images: prepared.map((p) => ({ key: p.key, url: publicUrlForKey(p.key), name: p.name })),
      results: prepared.map((p) => ({ imageKey: p.key, status: "pending" as const })),
    })
    .returning();

  const job = rows[0];
  if (!job) return jsonError("Could not create the job. Please try again.", 500);

  return NextResponse.json({
    jobId: job.id,
    uploads: prepared.map((p) => ({ key: p.key, name: p.name, url: p.url })),
  });
}

/** The writer's recent jobs. */
export async function GET() {
  const viewer = await requireOcrUser();
  if (isResponse(viewer)) return viewer;

  const rows = await db
    .select()
    .from(ocrJobs)
    .where(eq(ocrJobs.userId, viewer.userId))
    .orderBy(desc(ocrJobs.createdAt))
    .limit(20);

  return NextResponse.json({ jobs: rows.map(toJobView) });
}
