"use client";

import { useState, useTransition } from "react";
import { UserCheck, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

type FollowButtonProps = {
  authorId: string;
  signedIn: boolean;
  initialFollowing?: boolean;
  className?: string;
};

/** Follow / unfollow an author. */
export function FollowButton({
  authorId,
  signedIn,
  initialFollowing = false,
  className,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    if (!signedIn) {
      window.location.href =
        "/auth/sign-in?callbackUrl=" + encodeURIComponent(window.location.pathname);
      return;
    }
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
    <Button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={following}
      variant={following ? "secondary" : "default"}
      className={className}
    >
      {following ? <UserCheck /> : <UserPlus />}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
