"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { StoryGrid } from "./story-grid";
import type { StorySummary } from "./types";

type FilterKey = "all" | "ongoing" | "completed" | `lang:${string}`;

type StoryFiltersProps = {
  stories: StorySummary[];
  /** Extra chips appended after the status ones. */
  extra?: { key: string; label: string; count?: number }[];
  className?: string;
  emptyMessage?: string;
};

/**
 * Client-side filtering chips: All / Ongoing / Completed, then one chip per
 * language present in the results.
 */
export function StoryFilters({ stories, extra = [], className, emptyMessage }: StoryFiltersProps) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const story of stories) {
      const code = story.language || "en";
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [stories]);

  const filtered = useMemo(() => {
    if (filter === "all") return stories;
    if (filter === "ongoing") return stories.filter((s) => !s.isCompleted);
    if (filter === "completed") return stories.filter((s) => s.isCompleted);
    const lang = filter.slice("lang:".length);
    return stories.filter((s) => (s.language || "en") === lang);
  }, [stories, filter]);

  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: stories.length },
    { key: "ongoing", label: "Ongoing", count: stories.filter((s) => !s.isCompleted).length },
    { key: "completed", label: "Completed", count: stories.filter((s) => s.isCompleted).length },
    ...languages.map(([code, count]) => ({ key: `lang:${code}` as FilterKey, label: code.toUpperCase(), count })),
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            aria-pressed={filter === chip.key}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors tap",
              filter === chip.key
                ? "border-primary/30 bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {chip.label}
            <span className={cn("ml-1.5", filter === chip.key ? "opacity-80" : "text-muted-foreground")}>
              {chip.count}
            </span>
          </button>
        ))}
        {extra.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key as FilterKey)}
            aria-pressed={filter === chip.key}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors tap",
              filter === chip.key
                ? "border-primary/30 bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {chip.label}
            {typeof chip.count === "number" ? (
              <span className={cn("ml-1.5", filter === chip.key ? "opacity-80" : "text-muted-foreground")}>
                {chip.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <StoryGrid stories={filtered} emptyMessage={emptyMessage ?? "Nothing matches this filter yet."} />
    </div>
  );
}
