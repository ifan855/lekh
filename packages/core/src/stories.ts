import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@lekh/db";
import {
  chapters,
  favorites,
  parts,
  profiles,
  storyReadEvents,
  stories,
} from "@lekh/db";

export type StoryCard = {
  id: string;
  title: string;
  slug: string;
  description: string;
  language: string;
  coverKey: string | null;
  coverColor: string | null;
  tags: string[];
  fontPreset: string;
  wordCount: number;
  chapterCount: number;
  readCount: number;
  commentCount: number;
  featured: boolean;
  isCompleted: boolean;
  publishedAt: Date | null;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarKey: string | null;
};

const cardColumns = {
  id: stories.id,
  title: stories.title,
  slug: stories.slug,
  description: stories.description,
  language: stories.language,
  coverKey: stories.coverKey,
  coverColor: stories.coverColor,
  tags: stories.tags,
  fontPreset: stories.fontPreset,
  wordCount: stories.wordCount,
  chapterCount: stories.chapterCount,
  readCount: stories.readCount,
  commentCount: stories.commentCount,
  featured: stories.featured,
  isCompleted: stories.isCompleted,
  publishedAt: stories.publishedAt,
  authorId: stories.authorId,
  authorName: profiles.displayName,
  authorUsername: profiles.username,
  authorAvatarKey: profiles.avatarKey,
};

export async function storyCards(where: ReturnType<typeof eq> | undefined, limit = 24, offset = 0) {
  const query = db
    .select(cardColumns)
    .from(stories)
    .innerJoin(profiles, eq(profiles.id, stories.authorId));

  const rows = await (where
    ? query.where(where).orderBy(desc(stories.publishedAt)).limit(limit).offset(offset)
    : query.orderBy(desc(stories.publishedAt)).limit(limit).offset(offset));
  return rows;
}

const publishedPublic = and(eq(stories.status, "published"), eq(stories.visibility, "public"));

export async function trendingStories(limit = 24): Promise<StoryCard[]> {
  // Combine all-time popularity with a recency-weighted read signal.
  const [popular, recent] = await Promise.all([
    db
      .select(cardColumns)
      .from(stories)
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(publishedPublic)
      .orderBy(desc(stories.readCount))
      .limit(100),
    db
      .select({ storyId: storyReadEvents.storyId, reads: sql<number>`count(*)` })
      .from(storyReadEvents)
      .where(gte(storyReadEvents.createdAt, sql`now() - interval '14 days'`))
      .groupBy(storyReadEvents.storyId),
  ]);

  const recentById = new Map(recent.map((row) => [row.storyId, Number(row.reads)]));

  const scored = popular
    .filter((row) => row.publishedAt !== null)
    .map((row) => {
      const recency = recentById.get(row.id) ?? 0;
      const score =
        row.readCount * 0.35 +
        recency * 6 +
        row.commentCount * 2 +
        (row.featured ? 500 : 0);
      return { row, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry) => entry.row);
}

export async function newReleases(limit = 24): Promise<StoryCard[]> {
  return db
    .select(cardColumns)
    .from(stories)
    .innerJoin(profiles, eq(profiles.id, stories.authorId))
    .where(publishedPublic)
    .orderBy(desc(stories.publishedAt))
    .limit(limit);
}

export async function popularStories(limit = 24): Promise<StoryCard[]> {
  return db
    .select(cardColumns)
    .from(stories)
    .innerJoin(profiles, eq(profiles.id, stories.authorId))
    .where(publishedPublic)
    .orderBy(desc(stories.readCount))
    .limit(limit);
}

export async function featuredStories(limit = 12): Promise<StoryCard[]> {
  return db
    .select(cardColumns)
    .from(stories)
    .innerJoin(profiles, eq(profiles.id, stories.authorId))
    .where(and(publishedPublic, eq(stories.featured, true)))
    .orderBy(desc(stories.updatedAt))
    .limit(limit);
}

export async function storiesByTag(tag: string, limit = 48): Promise<StoryCard[]> {
  return db
    .select(cardColumns)
    .from(stories)
    .innerJoin(profiles, eq(profiles.id, stories.authorId))
    .where(and(publishedPublic, sql`${stories.tags} @> ARRAY[${tag}]`))
    .orderBy(desc(stories.readCount))
    .limit(limit);
}

export async function searchStories(query: string, limit = 30): Promise<StoryCard[]> {
  const q = `%${query.trim()}%`;
  return db
    .select(cardColumns)
    .from(stories)
    .innerJoin(profiles, eq(profiles.id, stories.authorId))
    .where(
      and(
        publishedPublic,
        or(
          ilike(stories.title, q),
          ilike(stories.description, q),
          ilike(profiles.displayName, q),
          ilike(profiles.username, q),
          sql`exists (select 1 from unnest(${stories.tags}) t where t ilike ${q})`,
        ),
      ),
    )
    .orderBy(desc(stories.readCount))
    .limit(limit);
}

export async function storiesByAuthor(authorId: string, includeUnlisted = false, viewerId?: string) {
  const rows = await db
    .select(cardColumns)
    .from(stories)
    .innerJoin(profiles, eq(profiles.id, stories.authorId))
    .where(
      and(
        eq(stories.authorId, authorId),
        includeUnlisted
          ? viewerId
            ? or(eq(stories.visibility, "public"), eq(stories.visibility, "unlisted"), eq(stories.authorId, viewerId))
            : inArray(stories.visibility, ["public", "unlisted"])
          : eq(stories.visibility, "public"),
      ),
    )
    .orderBy(desc(stories.updatedAt));
  return rows;
}

export async function relatedStories(storyId: string, limit = 12): Promise<StoryCard[]> {
  const current = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  const story = current[0];
  if (!story) return [];

  const tags = new Set(story.tags ?? []);
  if (tags.size === 0) return [];

  // Small community: filter tag overlap in JS rather than fighting array operators.
  const candidates = await db
    .select(cardColumns)
    .from(stories)
    .innerJoin(profiles, eq(profiles.id, stories.authorId))
    .where(and(publishedPublic, sql`${stories.id} <> ${storyId}`))
    .orderBy(desc(stories.readCount))
    .limit(300);

  return candidates
    .filter((row) => (row.tags ?? []).some((tag) => tags.has(tag)))
    .slice(0, limit);
}

export async function getStoryBundle(storyId: string) {
  const storyRows = await db
    .select({ ...cardColumns, authorId: stories.authorId, visibility: stories.visibility, status: stories.status })
    .from(stories)
    .innerJoin(profiles, eq(profiles.id, stories.authorId))
    .where(eq(stories.id, storyId))
    .limit(1);
  const story = storyRows[0];
  if (!story) return null;

  const partRows = await db.select().from(parts).where(eq(parts.storyId, storyId)).orderBy(asc(parts.position));
  const chapterRows = await db
    .select({
      id: chapters.id,
      partId: chapters.partId,
      title: chapters.title,
      position: chapters.position,
      wordCount: chapters.wordCount,
      thumbnailKey: chapters.thumbnailKey,
      isLocked: chapters.isLocked,
      updatedAt: chapters.updatedAt,
    })
    .from(chapters)
    .where(eq(chapters.storyId, storyId))
    .orderBy(asc(chapters.position));

  return { story, parts: partRows, chapters: chapterRows };
}

export async function getChapterContent(chapterId: string) {
  const rows = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  return rows[0] ?? null;
}

export async function favoriteStoryIds(userId: string): Promise<string[]> {
  const rows = await db.select({ storyId: favorites.storyId }).from(favorites).where(eq(favorites.userId, userId));
  return rows.map((r) => r.storyId);
}

/** Simple tag cloud for the explore page. */
export async function topTags(limit = 40): Promise<{ tag: string; count: number }[]> {
  const result = (await db.execute(sql`
    select t.tag as tag, count(*)::int as count
    from stories s cross join unnest(s.tags) as t(tag)
    where s.visibility = 'public' and s.status = 'published'
    group by t.tag
    order by count desc
    limit ${limit}
  `)) as unknown as { tag: string; count: number }[];
  const rows = result;
  return rows.map((row) => ({ tag: row.tag, count: Number(row.count) }));
}
