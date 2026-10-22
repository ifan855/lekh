import Link from "next/link";
import { and, desc, eq, or } from "drizzle-orm";
import { BookOpen, Eye, EyeOff, Globe, Lock, PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db, stories, storyEditors } from "@lekh/db";

import { NewStoryDialog } from "@/components/writer/new-story-dialog";
import { getViewer } from "@/lib/session";
import { coverGradient } from "@/lib/cover";
import { formatCount, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Write" };

export default async function WriteDashboard() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold">Sign in to start writing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your stories, drafts and collaborators live in your account.
        </p>
        <Button asChild className="mt-6">
          <Link href="/auth/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  }

  const owned = await db
    .select()
    .from(stories)
    .where(eq(stories.authorId, viewer.userId))
    .orderBy(desc(stories.updatedAt));

  const shared = await db
    .select({ story: stories })
    .from(storyEditors)
    .innerJoin(stories, eq(stories.id, storyEditors.storyId))
    .where(eq(storyEditors.userId, viewer.userId));

  const visibilityIcon = {
    public: Globe,
    unlisted: EyeOff,
    private: Lock,
  } as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Your stories</h1>
          <p className="text-sm text-muted-foreground">Drafts save automatically. Publish when it feels right.</p>
        </div>
        <div className="ml-auto">
          <NewStoryDialog />
        </div>
      </header>

      {owned.length === 0 && shared.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <PenLine className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 font-serif text-lg font-semibold">Nothing here yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Start with a title. The rest — chapters, tags, a cover — can come later.
          </p>
          <div className="mt-5 flex justify-center">
            <NewStoryDialog />
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {owned.map((story) => {
            const Icon = visibilityIcon[story.visibility as keyof typeof visibilityIcon] ?? Globe;
            return (
              <li key={story.id}>
                <Link
                  href={`/write/${story.id}`}
                  className="tap flex gap-4 rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-accent/40"
                >
                  <span
                    className="flex h-24 w-16 shrink-0 items-end rounded-md p-1.5 text-[10px] font-medium text-white/90 shadow-inner"
                    style={{ background: story.coverColor ?? coverGradient(story.id) }}
                  >
                    <span className="line-clamp-3">{story.title}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-serif text-base font-semibold">{story.title}</span>
                      {story.status === "published" ? (
                        <Badge variant="secondary" className="shrink-0">
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="shrink-0">
                          Draft
                        </Badge>
                      )}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {story.visibility}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {story.chapterCount} chapters
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {formatCount(story.readCount)}
                      </span>
                      <span>{timeAgo(story.updatedAt)}</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}

          {shared.length > 0 && (
            <li className="sm:col-span-2 mt-2">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Co-writing with others
              </p>
              <div className="flex flex-wrap gap-2">
                {shared.map(({ story }) => (
                  <Link
                    key={story.id}
                    href={`/write/${story.id}`}
                    className="tap rounded-lg border px-3 py-2 text-sm hover:bg-accent/40"
                  >
                    {story.title}
                  </Link>
                ))}
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
