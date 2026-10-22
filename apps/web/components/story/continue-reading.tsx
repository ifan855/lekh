import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";

import { db, chapters, readingProgress, stories } from "@lekh/db";
import { languageLabel } from "@/lib/languages";

import { CoverArt } from "./cover-art";

export type ContinueItem = {
  storyId: string;
  storyTitle: string;
  chapterId: string;
  chapterTitle: string;
  percent: number;
  coverKey: string | null;
  coverColor: string | null;
  language: string;
  updatedAt: string;
};

/**
 * "Continue reading" strip for signed-in readers, based on `reading_progress`.
 * Returns an empty list when the reader has no saved progress.
 */
export async function getContinueReading(userId: string, limit = 12): Promise<ContinueItem[]> {
  const rows = await db
    .select({
      storyId: stories.id,
      storyTitle: stories.title,
      coverKey: stories.coverKey,
      coverColor: stories.coverColor,
      language: stories.language,
      chapterId: chapters.id,
      chapterTitle: chapters.title,
      percent: readingProgress.percent,
      updatedAt: readingProgress.updatedAt,
    })
    .from(readingProgress)
    .innerJoin(chapters, eq(chapters.id, readingProgress.chapterId))
    .innerJoin(stories, eq(stories.id, chapters.storyId))
    .where(eq(readingProgress.userId, userId))
    .orderBy(desc(readingProgress.updatedAt))
    .limit(limit * 2);

  const seen = new Set<string>();
  const out: ContinueItem[] = [];
  for (const row of rows) {
    if (seen.has(row.storyId)) continue;
    seen.add(row.storyId);
    out.push({ ...row, updatedAt: new Date(row.updatedAt).toISOString() });
    if (out.length >= limit) break;
  }
  return out;
}

export function ContinueReadingStrip({ items }: { items: ContinueItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="continue-title" className="space-y-3">
      <div>
        <h2 id="continue-title" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
          Continue reading
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Pick up where you left off.</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={`${item.storyId}-${item.chapterId}`}>
            <Link
              href={`/read/${item.storyId}/${item.chapterId}`}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] tap"
            >
              <CoverArt
                title={item.storyTitle}
                coverKey={item.coverKey}
                coverColor={item.coverColor}
                language={item.language}
                seed={item.storyId}
                showTitle={false}
                showBadge={false}
                className="h-20 w-14 shrink-0 rounded-lg"
                sizes="56px"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold leading-snug">{item.storyTitle}</span>
                <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <BookOpen className="h-3 w-3 shrink-0" />
                  <span className="truncate">{item.chapterTitle || "Continue"}</span>
                </span>
                <span className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(4, Math.min(100, item.percent))}%` }}
                  />
                </span>
                <span className="mt-1 text-[0.65rem] text-muted-foreground">
                  {Math.max(0, Math.min(100, item.percent))}% · {languageLabel(item.language)}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The viewer's most recent chapter in this story, for the "Continue" button. */
export async function getLastReadChapter(
  userId: string,
  storyId: string,
): Promise<{ chapterId: string; percent: number } | null> {
  const rows = await db
    .select({ chapterId: readingProgress.chapterId, percent: readingProgress.percent })
    .from(readingProgress)
    .innerJoin(chapters, eq(chapters.id, readingProgress.chapterId))
    .where(and(eq(readingProgress.userId, userId), eq(chapters.storyId, storyId)))
    .orderBy(desc(readingProgress.updatedAt))
    .limit(1);

  const match = rows[0];
  if (!match) return null;
  return { chapterId: match.chapterId, percent: match.percent };
}
