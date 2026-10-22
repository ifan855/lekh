import type { Metadata } from "next";
import Link from "next/link";
import { Hash } from "lucide-react";

import { storiesByTag, topTags } from "@lekh/core";
import { Badge } from "@/components/ui/badge";

import { StoryGrid } from "@/components/story/story-grid";
import { TagPill } from "@/components/story/tag-pill";
import { toSummaries } from "@/components/story/types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  return {
    title: `#${decoded}`,
    description: `Stories tagged #${decoded} on lekh.`,
  };
}

export default async function TagPage({ params }: PageProps) {
  const { tag: rawTag } = await params;
  const tag = decodeURIComponent(rawTag).replace(/^#/, "").trim();

  const [stories, allTags] = await Promise.all([storiesByTag(tag, 48), topTags(30)]);

  const related = allTags.filter((t) => t.tag.toLowerCase() !== tag.toLowerCase()).slice(0, 16);

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-8">
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <Hash className="h-4 w-4" />
            Tag
          </span>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">#{tag}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {stories.length} {stories.length === 1 ? "story" : "stories"} tagged #{tag}
          </p>
        </div>
      </header>

      {/* Stories */}
      <section aria-labelledby="tagged-stories" className="space-y-4">
        <h2 id="tagged-stories" className="sr-only">
          Stories tagged #{tag}
        </h2>
        <StoryGrid
          stories={toSummaries(stories)}
          emptyMessage={`No stories tagged #${tag} yet. Be the first to write one.`}
        />
      </section>

      {/* Related tags */}
      {related.length > 0 ? (
        <section aria-labelledby="related-tags" className="space-y-3">
          <h2 id="related-tags" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
            Related tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {related.map(({ tag: t, count }) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <TagPill tag={t} size="md" className="px-3 py-1" />
                <Badge variant="muted">{count}</Badge>
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            <Link href="/" className="text-primary hover:underline">
              Back to explore
            </Link>
          </p>
        </section>
      ) : null}
    </div>
  );
}
