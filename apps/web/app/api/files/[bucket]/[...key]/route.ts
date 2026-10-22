import { NextResponse } from "next/server";

import { createDownloadUrl } from "@lekh/core";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ bucket: string; key: string[] }> };

const ALLOWED = new Set(["covers", "thumbnails", "avatars", "uploads"]);

export async function GET(_request: Request, { params }: Ctx) {
  const { bucket, key } = await params;
  if (!ALLOWED.has(bucket)) return NextResponse.json({ error: "Unknown bucket" }, { status: 404 });

  const objectKey = key.map(decodeURIComponent).join("/");
  try {
    const url = await createDownloadUrl(bucket as "covers", objectKey, 60 * 60);
    return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
