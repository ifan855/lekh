import "server-only";

import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
  sql as drizzleSql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  auditLog,
  chapters,
  commentReports,
  comments,
  db,
  ocrJobs,
  profiles,
  stories,
  storyReadEvents,
} from "@lekh/db";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  email: string | null;
  createdAt: Date;
  storyCount: number;
  commentCount: number;
};

export type AdminStoryRow = {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: string;
  visibility: string;
  tags: string[];
  featured: boolean;
  readCount: number;
  commentCount: number;
  chapterCount: number;
  wordCount: number;
  createdAt: Date;
  publishedAt: Date | null;
  authorId: string;
  authorUsername: string;
  authorName: string;
};

export type AdminReportRow = {
  id: string;
  status: string;
  reason: string;
  createdAt: Date;
  commentId: string;
  body: string;
  commentCreatedAt: Date;
  chapterId: string | null;
  chapterTitle: string | null;
  storyId: string;
  storyTitle: string;
  storySlug: string;
  reporterId: string;
  reporterUsername: string;
  reporterName: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
};

export type AdminTagRow = {
  tag: string;
  count: number;
};

export type AdminAuditRow = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: unknown;
  createdAt: Date;
  actorId: string | null;
  actorUsername: string | null;
  actorName: string | null;
};

export type AdminStats = {
  users: number;
  admins: number;
  banned: number;
  stories: number;
  published: number;
  drafts: number;
  comments: number;
  reads: number;
  ocrJobs: number;
  ocrFailed: number;
  openReports: number;
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * e-mail addresses live in the auth schema (`neon_auth.user`), not in
 * `profiles`. The lookup is best-effort: if the schema is unavailable we
 * simply show "—" instead of breaking the panel.
 */
async function loadEmails(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const result: unknown = await db.execute(
      drizzleSql`select id::text as id, email from neon_auth."user"`,
    );
    const rows = Array.isArray(result) ? (result as Array<{ id?: string; email?: string | null }>) : [];
    for (const row of rows) {
      if (row?.id && row.email) map.set(row.id, row.email);
    }
  } catch {
    /* auth schema not reachable — emails stay empty */
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * Stats
 * ------------------------------------------------------------------ */

export async function getStats(): Promise<AdminStats> {
  const [userRows, storyRows, commentRows, readRows, ocrRows, reportRows] = await Promise.all([
    db.select({ role: profiles.role, total: count() }).from(profiles).groupBy(profiles.role),
    db.select({ status: stories.status, total: count() }).from(stories).groupBy(stories.status),
    db.select({ total: count() }).from(comments),
    db.select({ total: count() }).from(storyReadEvents),
    db.select({ status: ocrJobs.status, total: count() }).from(ocrJobs).groupBy(ocrJobs.status),
    db.select({ total: count() }).from(commentReports).where(eq(commentReports.status, "open")),
  ]);

  let users = 0;
  let admins = 0;
  let banned = 0;
  for (const row of userRows) {
    users += row.total;
    if (row.role === "admin") admins = row.total;
    if (row.role === "banned") banned = row.total;
  }

  let published = 0;
  let drafts = 0;
  let totalStories = 0;
  for (const row of storyRows) {
    totalStories += row.total;
    if (row.status === "published") published = row.total;
    else drafts = row.total;
  }

  let ocrTotal = 0;
  let ocrFailed = 0;
  for (const row of ocrRows) {
    ocrTotal += row.total;
    if (row.status === "failed") ocrFailed = row.total;
  }

  return {
    users,
    admins,
    banned,
    stories: totalStories,
    published,
    drafts,
    comments: commentRows[0]?.total ?? 0,
    reads: readRows[0]?.total ?? 0,
    ocrJobs: ocrTotal,
    ocrFailed,
    openReports: reportRows[0]?.total ?? 0,
  };
}

/* ------------------------------------------------------------------ *
 * Users
 * ------------------------------------------------------------------ */

export async function listUsers(opts: { q?: string; role?: string; limit?: number } = {}): Promise<AdminUserRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const rows = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      role: profiles.role,
      createdAt: profiles.createdAt,
      storyCount: count(stories.id),
      commentCount: drizzleSql<number>`(
        select count(*)::int from comments c where c.author_id = ${profiles.id}
      )`,
    })
    .from(profiles)
    .leftJoin(stories, eq(stories.authorId, profiles.id))
    .groupBy(profiles.id)
    .orderBy(desc(profiles.createdAt))
    .limit(limit);

  const emails = await loadEmails();
  const q = opts.q?.trim().toLowerCase() ?? "";
  const role = opts.role?.trim() ?? "";

  return rows
    .map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      role: row.role,
      email: emails.get(row.id) ?? null,
      createdAt: row.createdAt,
      storyCount: Number(row.storyCount ?? 0),
      commentCount: Number(row.commentCount ?? 0),
    }))
    .filter((row) => {
      if (role && role !== "all" && row.role !== role) return false;
      if (!q) return true;
      return (
        row.username.toLowerCase().includes(q) ||
        row.displayName.toLowerCase().includes(q) ||
        (row.email?.toLowerCase().includes(q) ?? false)
      );
    });
}

/* ------------------------------------------------------------------ *
 * Stories
 * ------------------------------------------------------------------ */

export async function listStories(
  opts: { q?: string; status?: string; visibility?: string; author?: string; limit?: number } = {},
): Promise<AdminStoryRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const rows = await db
    .select({
      id: stories.id,
      title: stories.title,
      slug: stories.slug,
      description: stories.description,
      status: stories.status,
      visibility: stories.visibility,
      tags: stories.tags,
      featured: stories.featured,
      readCount: stories.readCount,
      commentCount: stories.commentCount,
      chapterCount: stories.chapterCount,
      wordCount: stories.wordCount,
      createdAt: stories.createdAt,
      publishedAt: stories.publishedAt,
      authorId: stories.authorId,
      authorUsername: profiles.username,
      authorName: profiles.displayName,
    })
    .from(stories)
    .innerJoin(profiles, eq(profiles.id, stories.authorId))
    .orderBy(desc(stories.createdAt))
    .limit(limit);

  const q = opts.q?.trim().toLowerCase() ?? "";
  const status = opts.status?.trim() ?? "";
  const visibility = opts.visibility?.trim() ?? "";
  const author = opts.author?.trim().toLowerCase() ?? "";

  return rows.filter((row) => {
    if (status && status !== "all" && row.status !== status) return false;
    if (visibility && visibility !== "all" && row.visibility !== visibility) return false;
    if (author) {
      const matchesAuthor =
        row.authorId.toLowerCase() === author ||
        row.authorUsername.toLowerCase() === author ||
        row.authorName.toLowerCase() === author;
      if (!matchesAuthor) return false;
    }
    if (!q) return true;
    return (
      row.title.toLowerCase().includes(q) ||
      row.description.toLowerCase().includes(q) ||
      row.authorUsername.toLowerCase().includes(q) ||
      row.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });
}

export async function getStoryById(id: string): Promise<AdminStoryRow | null> {
  const rows = await db
    .select({
      id: stories.id,
      title: stories.title,
      slug: stories.slug,
      description: stories.description,
      status: stories.status,
      visibility: stories.visibility,
      tags: stories.tags,
      featured: stories.featured,
      readCount: stories.readCount,
      commentCount: stories.commentCount,
      chapterCount: stories.chapterCount,
      wordCount: stories.wordCount,
      createdAt: stories.createdAt,
      publishedAt: stories.publishedAt,
      authorId: stories.authorId,
      authorUsername: profiles.username,
      authorName: profiles.displayName,
    })
    .from(stories)
    .innerJoin(profiles, eq(profiles.id, stories.authorId))
    .where(eq(stories.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * Comments & reports
 * ------------------------------------------------------------------ */

export async function listReports(opts: { status?: string; limit?: number } = {}): Promise<AdminReportRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 300);
  const status = opts.status?.trim() ?? "open";
  const authorAlias = alias(profiles, "comment_author");

  const rows = await db
    .select({
      id: commentReports.id,
      status: commentReports.status,
      reason: commentReports.reason,
      createdAt: commentReports.createdAt,
      commentId: comments.id,
      body: comments.body,
      commentCreatedAt: comments.createdAt,
      chapterId: comments.chapterId,
      chapterTitle: chapters.title,
      storyId: stories.id,
      storyTitle: stories.title,
      storySlug: stories.slug,
      reporterId: profiles.id,
      reporterUsername: profiles.username,
      reporterName: profiles.displayName,
      authorId: authorAlias.id,
      authorUsername: authorAlias.username,
      authorName: authorAlias.displayName,
    })
    .from(commentReports)
    .innerJoin(comments, eq(comments.id, commentReports.commentId))
    .innerJoin(stories, eq(stories.id, comments.storyId))
    .innerJoin(profiles, eq(profiles.id, commentReports.reporterId))
    .innerJoin(authorAlias, eq(authorAlias.id, comments.authorId))
    .leftJoin(chapters, eq(chapters.id, comments.chapterId))
    .where(status && status !== "all" ? eq(commentReports.status, status) : undefined)
    .orderBy(desc(commentReports.createdAt))
    .limit(limit);

  return rows;
}

/* ------------------------------------------------------------------ *
 * Tags
 * ------------------------------------------------------------------ */

export async function listTags(): Promise<AdminTagRow[]> {
  const result: unknown = await db.execute(
    drizzleSql`select t as tag, count(*)::int as count from stories s, unnest(s.tags) as t group by t order by count desc, t asc`,
  );
  const rows = Array.isArray(result)
    ? (result as Array<{ tag?: string; count?: number | string }>)
    : [];
  return rows
    .filter((row) => typeof row.tag === "string" && row.tag.length > 0)
    .map((row) => ({ tag: row.tag as string, count: Number(row.count ?? 0) }));
}

/** All stories that carry the given tag (used by rename / merge / delete). */
export async function storiesWithTag(tag: string): Promise<Array<{ id: string; tags: string[] }>> {
  const rows = await db
    .select({ id: stories.id, tags: stories.tags })
    .from(stories)
    .where(drizzleSql`${stories.tags} @> ARRAY[${tag}]::text[]`);
  return rows;
}

/* ------------------------------------------------------------------ *
 * Audit log
 * ------------------------------------------------------------------ */

export async function listAudit(
  opts: { action?: string; actor?: string; limit?: number } = {},
): Promise<AdminAuditRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      meta: auditLog.meta,
      createdAt: auditLog.createdAt,
      actorId: auditLog.actorId,
      actorUsername: profiles.username,
      actorName: profiles.displayName,
    })
    .from(auditLog)
    .leftJoin(profiles, eq(profiles.id, auditLog.actorId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  const action = opts.action?.trim().toLowerCase() ?? "";
  const actor = opts.actor?.trim().toLowerCase() ?? "";

  return rows.filter((row) => {
    if (action && action !== "all" && row.action.toLowerCase() !== action) return false;
    if (actor) {
      const haystack = `${row.actorUsername ?? ""} ${row.actorName ?? ""} ${row.actorId ?? ""}`.toLowerCase();
      if (!haystack.includes(actor)) return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

export async function getProfileById(id: string): Promise<typeof profiles.$inferSelect | null> {
  const rows = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function countAdmins(excludeId?: string): Promise<number> {
  const rows = await db
    .select({ total: count() })
    .from(profiles)
    .where(
      excludeId
        ? and(eq(profiles.role, "admin"), drizzleSql`${profiles.id} <> ${excludeId}`)
        : eq(profiles.role, "admin"),
    );
  return rows[0]?.total ?? 0;
}

export async function getRecentProfiles(limit: number): Promise<Array<typeof profiles.$inferSelect>> {
  return db.select().from(profiles).orderBy(desc(profiles.createdAt)).limit(limit);
}

export async function searchProfilesByTerm(term: string, limit = 20): Promise<Array<{ id: string; username: string; displayName: string }>> {
  return db
    .select({ id: profiles.id, username: profiles.username, displayName: profiles.displayName })
    .from(profiles)
    .where(or(ilike(profiles.username, `%${term}%`), ilike(profiles.displayName, `%${term}%`)))
    .limit(limit);
}
