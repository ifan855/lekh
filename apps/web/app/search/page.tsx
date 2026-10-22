import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, Sparkles } from "lucide-react";

import { popularStories, searchStories, topTags } from "@lekh/core";
import { Button } from "@/components/ui/button";

import { SearchBar } from "@/components/story/search-bar";
import { StoryGrid } from "@/components/story/story-grid";
import { TagPill } from "@/components/story/tag-pill";
import { toSummaries } from "@/components/story/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  description: "Search stories, authors and tags on lekh.",
};

type PageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = firstValue(params.q).trim();

  const [results, tags, popular] = await Promise.all([
    query.length > 0 ? searchStories(query, 48) : Promise.resolve([]),
    topTags(20),
    query.length > 0 ? Promise.resolve([]) : popularStories(8),
  ]);

  const summaries = toSummaries(results);

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="space-y-4">
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          {query ? `Results for “${query}”` : "Search lekh"}
        </h1>
        <div className="max-w-xl">
          <SearchBar initialQuery={query} autoFocus={!query} />
        </div>
        {query ? (
          <p className="text-sm text-muted-foreground">
            {summaries.length} {summaries.length === 1 ? "story" : "stories"} found
          </p>
        ) : null}
      </header>

      {/* Results */}
      {query ? (
        summaries.length > 0 ? (
          <StoryGrid stories={summaries} emptyMessage="No stories matched that search." />
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-12 text-center">
              <SearchX className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Nothing matched “{query}”.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a shorter phrase, a tag name, or an author&apos;s handle.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/search">Clear search</Link>
              </Button>
            </div>

            <section aria-labelledby="suggest-tags" className="space-y-3">
              <h2 id="suggest-tags" className="font-serif text-xl font-semibold tracking-tight">
                Popular tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {tags.map(({ tag }) => (
                  <TagPill key={tag} tag={tag} size="md" className="px-3 py-1" />
                ))}
              </div>
            </section>
          </div>
        )
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="popular-tags" className="space-y-3">
            <h2 id="popular-tags" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
              Popular tags
            </h2>
            <div className="flex flex-wrap gap-2">
              {tags.map(({ tag }) => (
                <TagPill key={tag} tag={tag} size="md" className="px-3 py-1" />
              ))}
            </div>
          </section>

          {popular.length > 0 ? (
            <section aria-labelledby="popular-stories" className="space-y-4">
              <h2
                id="popular-stories"
                className="flex items-center gap-2 font-serif text-xl font-semibold tracking-tight sm:text-2xl"
              >
                <Sparkles className="h-5 w-5 text-primary" />
                Popular right now
              </h2>
              <StoryGrid stories={toSummaries(popular)} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
