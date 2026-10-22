import type { StoryCard } from "@lekh/core";

/**
 * Serializable version of the core `StoryCard` row.
 *
 * Server components convert rows to this shape before handing them to the
 * client islands (dates become ISO strings so they survive RSC serialisation).
 */
export type StorySummary = {
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
  publishedAt: string | null;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarKey: string | null;
  /** Only present on the story detail page. */
  visibility?: string;
  status?: string;
};

export function toSummary(card: StoryCard): StorySummary {
  return {
    id: card.id,
    title: card.title,
    slug: card.slug,
    description: card.description,
    language: card.language,
    coverKey: card.coverKey,
    coverColor: card.coverColor,
    tags: card.tags ?? [],
    fontPreset: card.fontPreset,
    wordCount: card.wordCount,
    chapterCount: card.chapterCount,
    readCount: card.readCount,
    commentCount: card.commentCount,
    featured: card.featured,
    isCompleted: card.isCompleted,
    publishedAt: card.publishedAt ? new Date(card.publishedAt).toISOString() : null,
    authorId: card.authorId,
    authorName: card.authorName,
    authorUsername: card.authorUsername,
    authorAvatarKey: card.authorAvatarKey,
  };
}

export function toSummaries(cards: StoryCard[]): StorySummary[] {
  return cards.map(toSummary);
}
