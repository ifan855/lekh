import { NextResponse } from "next/server";
import { z } from "zod";

import { BUCKETS, createUploadUrl, objectKey } from "@lekh/core";

import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  bucket: z.enum(["covers", "thumbnails", "avatars", "uploads"]),
  name: z.string().min(1).max(200),
  contentType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/),
  folder: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });

  const { bucket, name, contentType, folder } = parsed.data;
  const key = objectKey(folder ?? viewer.userId, name);
  const { url } = await createUploadUrl(BUCKETS[bucket], key, contentType, 900);
  return NextResponse.json({ key, url, bucket });
}
