import { and, eq, inArray, or } from "drizzle-orm";

import { db, profiles, storyEditors, stories } from "@lekh/db";
import type { Story } from "@lekh/db";

export type Viewer = {
  id?: string;
  userId?: string;
  role: "user" | "admin";
} | null;

function viewerId(viewer: Viewer): string | undefined {
  return viewer?.id ?? viewer?.userId ?? undefined;
}

export type StoryAccess = {
  canView: boolean;
  canEdit: boolean;
  canComment: boolean;
  isOwner: boolean;
};

/**
 * Visibility rules
 *  - public   : visible to everyone, listed in explore/search
 *  - unlisted : visible to anyone with the link, not listed
 *  - private  : visible to the author and invited co-authors only
 */
export async function getStoryAccess(story: Story, viewer: Viewer): Promise<StoryAccess> {
  const isOwner = viewerId(viewer) === story.authorId;
  const isAdmin = viewer?.role === "admin";
  let isEditor = false;

  if (viewer && !isOwner) {
    const rows = await db
      .select({ userId: storyEditors.userId })
      .from(storyEditors)
      .where(and(eq(storyEditors.storyId, story.id), eq(storyEditors.userId, viewerId(viewer)!)))
      .limit(1);
    isEditor = rows.length > 0;
  }

  const canEdit = Boolean(isOwner || isEditor || isAdmin);
  const canView = story.visibility === "public" || story.visibility === "unlisted" || canEdit;

  return {
    canView,
    canEdit,
    canComment: canView && story.visibility !== "private",
    isOwner,
  };
}

/** Story ids the viewer may edit (owned + co-authored). */
export async function editableStoryIds(viewerId: string): Promise<string[]> {
  const owned = await db
    .select({ id: stories.id })
    .from(stories)
    .where(eq(stories.authorId, viewerId));
  const shared = await db
    .select({ storyId: storyEditors.storyId })
    .from(storyEditors)
    .where(eq(storyEditors.userId, viewerId));
  return [...owned.map((r) => r.id), ...shared.map((r) => r.storyId)];
}

export async function isAdmin(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return rows[0]?.role === "admin";
}

/** Ensure a profile row exists for an auth user. */
export async function ensureProfile(
  userId: string,
  data: { email?: string | null; name?: string | null },
): Promise<{ id: string; username: string; displayName: string; role: string; avatarKey: string | null; bio: string; language: string }> {
  const existing = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (existing[0]) return existing[0];

  const base = (data.name || data.email?.split("@")[0] || "reader").toLowerCase().replace(/[^a-z0-9_]/g, "");
  let username = base || "reader";
  let attempt = 1;
  // NOTE: an empty array is truthy in JS — the loop condition must check .length,
  // otherwise this spins forever and every signed-in request times out.
  for (let guard = 0; guard < 50; guard += 1) {
    const taken = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, username))
      .limit(1);
    if (taken.length === 0) break;
    attempt += 1;
    username = `${base || "reader"}${attempt}`;
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin =
    adminEmails.length > 0 && adminEmails.includes((data.email ?? "").trim().toLowerCase());

  const inserted = await db
    .insert(profiles)
    .values({
      id: userId,
      username,
      displayName: data.name || base || "Reader",
      role: isAdmin ? "admin" : "user",
    })
    .returning();
  return inserted[0];
}

export { and, eq, inArray, or };
