import Link from "next/link";

import { cn } from "@/lib/utils";

import { avatarUrl } from "./files";

type AuthorLineProps = {
  name: string;
  username: string;
  avatarKey?: string | null;
  size?: "sm" | "md" | "lg";
  showHandle?: boolean;
  className?: string;
};

const SIZES = {
  sm: { wrap: "h-6 w-6", text: "text-xs" },
  md: { wrap: "h-8 w-8", text: "text-sm" },
  lg: { wrap: "h-12 w-12", text: "text-base" },
} as const;

/** Avatar + name, linking to the author profile. */
export function AuthorLine({
  name,
  username,
  avatarKey,
  size = "md",
  showHandle = true,
  className,
}: AuthorLineProps) {
  const src = avatarUrl(avatarKey);
  const s = SIZES[size];

  return (
    <Link
      href={`/profile/${encodeURIComponent(username)}`}
      className={cn("group inline-flex min-w-0 items-center gap-2 tap", className)}
    >
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary ring-1 ring-border",
          s.wrap,
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="font-medium text-muted-foreground">
            {(name || username || "?").trim().charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={cn("truncate font-medium group-hover:text-primary", s.text)}>{name}</span>
        {showHandle ? (
          <span className="truncate text-[0.7rem] text-muted-foreground">@{username}</span>
        ) : null}
      </span>
    </Link>
  );
}
