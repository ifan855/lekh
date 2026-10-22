import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db, profiles } from "@lekh/db";

import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .optional(),
  bio: z.string().trim().max(1000).optional(),
  language: z.string().trim().min(2).max(8).optional(),
  avatarKey: z.string().nullable().optional(),
});

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile", details: parsed.error.flatten() }, { status: 400 });
  }

  const { username, ...rest } = parsed.data;
  if (username && username !== viewer.username) {
    const taken = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, username))
      .limit(1);
    if (taken.length) {
      return NextResponse.json({ error: "That username is taken" }, { status: 409 });
    }
  }

  const updated = await db
    .update(profiles)
    .set({ ...rest, ...(username ? { username } : {}), updatedAt: new Date() })
    .where(eq(profiles.id, viewer.userId))
    .returning();

  return NextResponse.json({ profile: updated[0] });
}
