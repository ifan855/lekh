import { cn } from "@/lib/utils";

import { StoryCard } from "./story-card";
import type { StorySummary } from "./types";

type StoryGridProps = {
  stories: StorySummary[];
  className?: string;
  emptyMessage?: string;
  showTags?: boolean;
  showStats?: boolean;
};

/** Responsive grid of story cards: 2 columns on mobile, 3–4 on desktop. */
export function StoryGrid({
  stories,
  className,
  emptyMessage = "No stories here yet.",
  showTags = true,
  showStats = true,
}: StoryGridProps) {
  if (stories.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-4",
        className,
      )}
    >
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} showTags={showTags} showStats={showStats} />
      ))}
    </div>
  );
}
