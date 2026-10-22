"use client";

import { useState, useTransition } from "react";
import { Heart, UserPlus, UserCheck, Bookmark, BookmarkCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SocialButtonsProps = {
  storyId: string;
  authorId: string;
  signedIn: boolean;
  initialFavorited?: boolean;
  initialFollowing?: boolean;
  className?: string;
};

export function SocialButtons({
  storyId,
  authorId,
  signedIn,
  initialFavorited = false,
  initialFollowing = false,
  className,
}: SocialButtonsProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  const requireSignIn = () => {
    if (signedIn) return false;
    window.location.href = "/auth/sign-in?callbackUrl=" + encodeURIComponent(window.location.pathname);
    return true;
  };

  const toggleFavorite = () => {
    if (requireSignIn()) return;
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      try {
        const res = await fetch("/api/social/favorite", {
          method: next ? "POST" : "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ storyId }),
        });
        if (!res.ok) setFavorited(!next);
      } catch {
        setFavorited(!next);
      }
    });
  };

  const toggleFollow = () => {
    if (requireSignIn()) return;
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      try {
        const res = await fetch("/api/social/follow", {
          method: next ? "POST" : "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ authorId }),
        });
        if (!res.ok) setFollowing(!next);
      } catch {
        setFollowing(!next);
      }
    });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        variant={following ? "secondary" : "outline"}
        onClick={toggleFollow}
        disabled={pending}
        aria-pressed={following}
      >
        {following ? <UserCheck /> : <UserPlus />}
        {following ? "Following" : "Follow"}
      </Button>

      <Button
        type="button"
        variant={favorited ? "default" : "outline"}
        onClick={toggleFavorite}
        disabled={pending}
        aria-pressed={favorited}
      >
        {favorited ? <BookmarkCheck /> : <Bookmark />}
        {favorited ? "In library" : "Add to library"}
      </Button>

      <span className="sr-only" aria-live="polite">
        {favorited ? "Story saved to your library" : "Story removed from your library"}
      </span>
      <Heart className="hidden" aria-hidden />
    </div>
  );
}
