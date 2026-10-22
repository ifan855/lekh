import Link from "next/link";
import { ArrowRight, Compass, Globe2, PenLine, Sparkles } from "lucide-react";

import {
  featuredStories,
  newReleases,
  popularStories,
  storiesByTag,
  topTags,
  trendingStories,
} from "@lekh/core";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/session";
import { languageLabel } from "@/lib/languages";

import { Carousel } from "@/components/story/carousel";
import { ContinueReadingStrip, getContinueReading } from "@/components/story/continue-reading";
import { SearchBar } from "@/components/story/search-bar";
import { StoryCard } from "@/components/story/story-card";
import { StoryGrid } from "@/components/story/story-grid";
import { TagPill } from "@/components/story/tag-pill";
import { toSummaries } from "@/components/story/types";

export const dynamic = "force-dynamic";

function StorySlide({ story }: { story: ReturnType<typeof toSummaries>[number] }) {
  return (
    <div className="w-[9.5rem] shrink-0 snap-start sm:w-44 lg:w-48">
      <StoryCard story={story} />
    </div>
  );
}

export default async function ExplorePage() {
  const viewer = await getViewer();

  const [trending, fresh, popular, featured, tags, continueItems] = await Promise.all([
    trendingStories(14),
    newReleases(14),
    popularStories(14),
    featuredStories(10),
    topTags(28),
    viewer ? getContinueReading(viewer.userId, 6) : Promise.resolve([]),
  ]);

  const trendingStoriesData = toSummaries(trending);
  const freshData = toSummaries(fresh);
  const popularData = toSummaries(popular);
  const featuredData = toSummaries(featured);

  // A couple of featured tags to seed the grid below the tag cloud.
  const seedTags = tags.slice(0, 3).map((t) => t.tag);
  const seeded = (
    await Promise.all(seedTags.map((tag) => storiesByTag(tag, 4)))
  ).flat();

  const seededSeen = new Set<string>();
  const seededUnique = seeded.filter((s) => {
    if (seededSeen.has(s.id)) return false;
    seededSeen.add(s.id);
    return true;
  }).slice(0, 8);

  return (
    <div className="space-y-12 px-4 py-6 sm:px-6 sm:py-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-accent/40 px-5 py-8 shadow-sm sm:px-10 sm:py-12">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Stories for every mood
          </span>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Find your next story
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Read serials, browse by tag, and follow the writers you love — in your own language.
          </p>

          <div className="mt-5 max-w-xl">
            <SearchBar />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href="/write">
                <PenLine />
                Start writing
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/search">
                <Compass />
                Browse everything
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Continue reading */}
      {continueItems.length > 0 ? <ContinueReadingStrip items={continueItems} /> : null}

      {/* Trending */}
      {trendingStoriesData.length > 0 ? (
        <Carousel
          id="trending"
          title="Trending"
          subtitle="What readers are picking up right now"
          action={
            <Link
              href="/search?sort=trending"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              See all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {trendingStoriesData.map((story) => (
            <StorySlide key={story.id} story={story} />
          ))}
        </Carousel>
      ) : null}

      {/* New & rising */}
      {freshData.length > 0 ? (
        <Carousel id="new" title="New & rising" subtitle="Freshly published chapters">
          {freshData.map((story) => (
            <StorySlide key={story.id} story={story} />
          ))}
        </Carousel>
      ) : null}

      {/* Popular */}
      {popularData.length > 0 ? (
        <Carousel id="popular" title="Popular" subtitle="Most read on lekh">
          {popularData.map((story) => (
            <StorySlide key={story.id} story={story} />
          ))}
        </Carousel>
      ) : null}

      {/* Staff picks */}
      {featuredData.length > 0 ? (
        <Carousel id="staff" title="Staff picks" subtitle="Hand-picked by the lekh team">
          {featuredData.map((story) => (
            <StorySlide key={story.id} story={story} />
          ))}
        </Carousel>
      ) : null}

      {/* Tag cloud */}
      {tags.length > 0 ? (
        <section aria-labelledby="tags-title" className="space-y-4">
          <div>
            <h2 id="tags-title" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
              Browse by tag
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Every genre, trope and obsession — tap a tag to dive in.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map(({ tag, count }) => (
              <TagPill key={tag} tag={tag} size="md" className="px-3 py-1" />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {tags.length} popular tags · <Link href="/search" className="text-primary hover:underline">see all</Link>
          </p>
        </section>
      ) : null}

      {/* Seeded stories by tag */}
      {seededUnique.length > 0 ? (
        <section aria-labelledby="tagged-title" className="space-y-4">
          <h2 id="tagged-title" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
            Stories you might like
          </h2>
          <StoryGrid stories={toSummaries(seededUnique)} />
        </section>
      ) : null}

      {/* Footer */}
      <footer className="space-y-4 border-t border-border pt-6 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <Globe2 className="h-4 w-4" />
            {languageLabel("en")}+ languages supported
          </span>
          <Link href="/write" className="font-medium text-primary hover:underline">
            Write a story
          </Link>
          <Link href="/search" className="hover:text-foreground hover:underline">
            Browse all stories
          </Link>
        </div>
        <p className="max-w-2xl text-xs leading-relaxed">
          lekh keeps every story in the language its author chose. Use the search page and the
          language chips to filter results, and the language badge on a cover to spot a story in
          your own language.
        </p>
        <p className="text-xs">© {new Date().getFullYear()} lekh · v0.1.1</p>
      </footer>
    </div>
  );
}
