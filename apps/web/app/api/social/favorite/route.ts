import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db, favorites } from "@lekh/db";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

type Body = { storyId?: string };

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to favourite stories." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const storyId = body.storyId?.trim();
  if (!storyId) {
    return NextResponse.json({ error: "storyId is required." }, { status: 400 });
  }

  const existing = await db
    .select({ storyId: favorites.storyId })
    .from(favorites)
    .where(and(eq(favorites.userId, viewer.userId), eq(favorites.storyId, storyId)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(favorites).values({ userId: viewer.userId, storyId }).onConflictDoNothing();
  }

  return NextResponse.json({ favorited: true });
}

export async function DELETE(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to favourite stories." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const storyId = body.storyId?.trim();
  if (!storyId) {
    return NextResponse.json({ error: "storyId is required." }, { status: 400 });
  }

  await db
    .delete(favorites)
    .where(and(eq(favorites.userId, viewer.userId), eq(favorites.storyId, storyId)));

  return NextResponse.json({ favorited: false });
}
