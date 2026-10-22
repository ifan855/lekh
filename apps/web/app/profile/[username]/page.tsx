import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, PenLine, UserCheck, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/session";
import { languageLabel } from "@/lib/languages";
import { formatCount } from "@/lib/utils";

import { AuthorLine } from "@/components/story/author-line";
import { FollowButton } from "@/components/story/follow-button";
import { StoryGrid } from "@/components/story/story-grid";
import { getProfileByUsername, isFollowing, profileCounts, profileStories } from "@/components/story/data";
import { avatarUrl } from "@/components/story/files";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) return { title: "Profile not found" };
  return {
    title: `${profile.displayName} (@${profile.username})`,
    description: profile.bio || `Stories by ${profile.displayName} on lekh.`,
  };
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params;
  const viewer = await getViewer();

  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const isSelf = viewer?.userId === profile.id;

  const [counts, stories, following] = await Promise.all([
    profileCounts(profile.id),
    profileStories(profile.id, isSelf, viewer?.userId),
    isFollowing(viewer?.userId ?? null, profile.id),
  ]);

  const avatar = avatarUrl(profile.avatarKey);
  const joined = new Date(profile.createdAt).toLocaleDateString("en", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-8">
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary ring-1 ring-border sm:h-24 sm:w-24">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-serif text-2xl font-semibold text-muted-foreground">
                {profile.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              {profile.displayName}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">@{profile.username}</p>

            {profile.bio ? (
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-3 text-sm italic text-muted-foreground">No bio yet.</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="h-4 w-4" />
                {formatCount(counts.followers)} {counts.followers === 1 ? "follower" : "followers"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" />
                {formatCount(counts.following)} following
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Joined {joined}
              </span>
              <Badge variant="muted">{languageLabel(profile.language)}</Badge>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {isSelf ? (
                <Button asChild variant="secondary">
                  <Link href="/write">
                    <PenLine />
                    Write a story
                  </Link>
                </Button>
              ) : (
                <FollowButton
                  authorId={profile.id}
                  signedIn={Boolean(viewer)}
                  initialFollowing={following}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Stories */}
      <section aria-labelledby="stories-title" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 id="stories-title" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
            {isSelf ? "Your stories" : "Stories"}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{stories.length}</span>
          </h2>
        </div>
        <StoryGrid
          stories={stories}
          emptyMessage={
            isSelf
              ? "You haven't published anything yet. Start your first story."
              : "This author has not published any public stories yet."
          }
        />
      </section>
    </div>
  );
}
