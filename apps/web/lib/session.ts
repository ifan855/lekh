import "server-only";

import { cache } from "react";

import { ensureProfile } from "@lekh/core";
import { db, profiles } from "@lekh/db";
import { eq } from "drizzle-orm";

import { auth } from "./auth-server";

export type Viewer = {
  userId: string;
  email: string | null;
  name: string | null;
  role: "user" | "admin";
  username: string;
  displayName: string;
  avatarKey: string | null;
};

type SessionShape = {
  user?: { id?: string; email?: string; name?: string };
  session?: { id?: string };
};

/** Resolve the current viewer (cached per request). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  let session: unknown;
  try {
    session = await auth.getSession();
  } catch {
    return null;
  }
  const data = session as { data?: SessionShape } | SessionShape | null;
  const shape = (data && typeof data === "object" && "data" in data ? data.data : data) as
    | SessionShape
    | null;
  const userId = shape?.user?.id;
  if (!userId) return null;

  const email = shape?.user?.email ?? null;
  const name = shape?.user?.name ?? null;

  const profile = await ensureProfile(userId, { email, name });
  const role = profile.role === "admin" ? "admin" : "user";

  return {
    userId,
    email,
    name,
    role,
    username: profile.username,
    displayName: profile.displayName,
    avatarKey: profile.avatarKey,
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Not authenticated");
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") throw new Error("Forbidden");
  return viewer;
}

export async function updateProfile(
  userId: string,
  patch: Partial<{ displayName: string; bio: string; avatarKey: string | null; language: string }>,
) {
  await db.update(profiles).set({ ...patch, updatedAt: new Date() }).where(eq(profiles.id, userId));
}
