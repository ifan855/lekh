import Link from "next/link";

import { cn } from "@/lib/utils";

type TagPillProps = {
  tag: string;
  size?: "sm" | "md";
  className?: string;
  active?: boolean;
};

/** A tag chip that links to the tag landing page. */
export function TagPill({ tag, size = "sm", className, active = false }: TagPillProps) {
  return (
    <Link
      href={`/tag/${encodeURIComponent(tag)}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium transition-colors tap",
        size === "sm" ? "text-[0.7rem]" : "text-xs",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-secondary/70 text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      <span className="truncate">#{tag}</span>
    </Link>
  );
}
