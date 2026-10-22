import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db, follows } from "@lekh/db";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

type Body = { authorId?: string };

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to follow authors." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const authorId = body.authorId?.trim();
  if (!authorId) {
    return NextResponse.json({ error: "authorId is required." }, { status: 400 });
  }
  if (authorId === viewer.userId) {
    return NextResponse.json({ error: "You cannot follow yourself." }, { status: 400 });
  }

  const target = await db
    .select({ id: follows.authorId })
    .from(follows)
    .where(and(eq(follows.followerId, viewer.userId), eq(follows.authorId, authorId)))
    .limit(1);

  if (target.length === 0) {
    await db.insert(follows).values({ followerId: viewer.userId, authorId }).onConflictDoNothing();
  }

  return NextResponse.json({ following: true });
}

export async function DELETE(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to follow authors." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const authorId = body.authorId?.trim();
  if (!authorId) {
    return NextResponse.json({ error: "authorId is required." }, { status: 400 });
  }

  await db
    .delete(follows)
    .where(and(eq(follows.followerId, viewer.userId), eq(follows.authorId, authorId)));

  return NextResponse.json({ following: false });
}
