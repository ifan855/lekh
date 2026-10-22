import Link from "next/link";
import { BookOpen, CheckCircle2, MessageCircle, Sparkles } from "lucide-react";

import { formatCount } from "@/lib/utils";
import { cn } from "@/lib/utils";

import { CoverArt } from "./cover-art";
import { TagPill } from "./tag-pill";
import type { StorySummary } from "./types";

type StoryCardProps = {
  story: StorySummary;
  className?: string;
  /** Show the tag pills under the title. */
  showTags?: boolean;
  /** Show the stats row (reads / chapters / comments). */
  showStats?: boolean;
  compact?: boolean;
};

export function StoryCard({
  story,
  className,
  showTags = true,
  showStats = true,
  compact = false,
}: StoryCardProps) {
  const tags = (story.tags ?? []).slice(0, 2);

  return (
    <Link
      href={`/story/${story.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-md active:translate-y-0 active:scale-[0.99] tap",
        className,
      )}
    >
      <div className="relative">
        <CoverArt
          title={story.title}
          coverKey={story.coverKey}
          coverColor={story.coverColor}
          language={story.language}
          fontPreset={story.fontPreset}
          seed={story.id}
          showTitle={!story.coverKey}
          className="rounded-none shadow-none"
          sizes="(max-width: 640px) 45vw, 300px"
        />
        {story.featured ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.65rem] font-medium text-white backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            Staff pick
          </span>
        ) : null}
        {story.isCompleted ? (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-700 shadow-sm">
            <CheckCircle2 className="h-3 w-3" />
            Complete
          </span>
        ) : null}
      </div>

      <div className={cn("flex flex-1 flex-col gap-2 p-3", compact && "p-2.5")}>
        <h3
          className={cn(
            "line-clamp-2 font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary",
            compact ? "text-sm" : "text-[0.95rem]",
          )}
        >
          {story.title}
        </h3>

        <p className="truncate text-xs text-muted-foreground">
          {story.authorName} <span className="text-muted-foreground/70">@{story.authorUsername}</span>
        </p>

        {showTags && tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        ) : null}

        {showStats ? (
          <div className="mt-auto flex items-center gap-3 pt-1 text-[0.7rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {formatCount(story.readCount)} reads
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {formatCount(story.commentCount)}
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
