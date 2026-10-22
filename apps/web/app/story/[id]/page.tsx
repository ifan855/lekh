import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import {
  BookOpen,
  ChevronRight,
  Eye,
  FileText,
  Globe2,
  Lock,
  MessageCircle,
  Pencil,
  Unlock,
  Users,
} from "lucide-react";

import { favoriteStoryIds, getStoryBundle, relatedStories } from "@lekh/core";
import { CommentThread } from "@/components/comments/comment-thread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/session";
import { languageLabel } from "@/lib/languages";
import { formatCount } from "@/lib/utils";

import { AuthorLine } from "@/components/story/author-line";
import { CoverArt } from "@/components/story/cover-art";
import { Carousel } from "@/components/story/carousel";
import { SocialButtons } from "@/components/story/social-buttons";
import { StoryCard } from "@/components/story/story-card";
import { TagPill } from "@/components/story/tag-pill";
import {
  chapterCommentCounts,
  isFollowing,
  nextChapterFor,
  storyAccess,
  storyChapters,
} from "@/components/story/data";
import { getLastReadChapter } from "@/components/story/continue-reading";
import { thumbnailUrl } from "@/components/story/files";
import { toSummaries } from "@/components/story/types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Story not found" };
  const bundle = await getStoryBundle(id);
  if (!bundle) return { title: "Story not found" };
  const { story } = bundle;
  return {
    title: story.title,
    description: story.description || `Read "${story.title}" by ${story.authorName} on lekh.`,
    openGraph: {
      title: story.title,
      description: story.description,
      type: "article",
    },
  };
}

export default async function StoryPage({ params }: PageProps) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const viewer = await getViewer();

  const [bundle, accessInfo] = await Promise.all([getStoryBundle(id), storyAccess(id, viewer)]);

  if (!bundle || !accessInfo) notFound();

  const { story, parts } = bundle;
  const { access } = accessInfo;

  if (!access.canView) notFound();

  const [chapters, counts, favorites, following, related, lastRead] = await Promise.all([
    storyChapters(id),
    chapterCommentCounts(id),
    viewer ? favoriteStoryIds(viewer.userId) : Promise.resolve<string[]>([]),
    isFollowing(viewer?.userId ?? null, story.authorId),
    relatedStories(id, 10),
    viewer ? getLastReadChapter(viewer.userId, id) : Promise.resolve(null),
  ]);

  const firstChapter = chapters[0] ?? null;
  const nextChapter = await nextChapterFor(id, lastRead?.chapterId ?? null);
  const readTarget = lastRead ? nextChapter ?? firstChapter : firstChapter;

  const grouped = new Map<string | null, typeof chapters>();
  for (const chapter of chapters) {
    const list = grouped.get(chapter.partId) ?? [];
    list.push(chapter);
    grouped.set(chapter.partId, list);
  }
  const chaptersByPart = grouped;

  const partTitle = (partId: string | null) =>
    parts.find((part) => part.id === partId)?.title?.trim() || "";

  const wordCount =
    story.wordCount || chapters.reduce((sum: number, c: (typeof chapters)[number]) => sum + (c.wordCount || 0), 0);

  return (
    <div className="space-y-10 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-56 lg:w-64">
          <CoverArt
            title={story.title}
            coverKey={story.coverKey}
            coverColor={story.coverColor}
            language={story.language}
            fontPreset={story.fontPreset}
            seed={story.id}
            showTitle={!story.coverKey}
            className="shadow-md"
            sizes="(max-width: 640px) 160px, 256px"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {story.visibility !== "public" ? (
              <Badge variant={story.visibility === "private" ? "destructive" : "muted"}>
                {story.visibility === "private" ? <Lock className="mr-1 h-3 w-3" /> : <Unlock className="mr-1 h-3 w-3" />}
                {story.visibility === "private" ? "Private" : "Unlisted"}
              </Badge>
            ) : null}
            {story.status !== "published" ? <Badge variant="muted">Draft</Badge> : null}
            {story.featured ? <Badge>Staff pick</Badge> : null}
            {story.isCompleted ? <Badge variant="secondary">Completed</Badge> : null}
            <Badge variant="outline" className="gap-1">
              <Globe2 className="h-3 w-3" />
              {languageLabel(story.language)}
            </Badge>
          </div>

          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {story.title}
          </h1>

          <div className="mt-3">
            <AuthorLine
              name={story.authorName}
              username={story.authorUsername}
              avatarKey={story.authorAvatarKey}
              size="md"
            />
          </div>

          {story.description ? (
            <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 sm:text-base">
              {story.description}
            </p>
          ) : null}

          {story.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {story.tags.map((tag) => (
                <TagPill key={tag} tag={tag} size="md" />
              ))}
            </div>
          ) : null}

          {/* Stats */}
          <dl className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              <dt className="sr-only">Reads</dt>
              <dd>{formatCount(story.readCount)} reads</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              <dt className="sr-only">Chapters</dt>
              <dd>
                {formatCount(chapters.length)} {chapters.length === 1 ? "chapter" : "chapters"}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <dt className="sr-only">Words</dt>
              <dd>{formatCount(wordCount)} words</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" />
              <dt className="sr-only">Comments</dt>
              <dd>{formatCount(story.commentCount)} comments</dd>
            </div>
            {story.publishedAt ? (
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <dt className="sr-only">Published</dt>
                <dd>
                  Published{" "}
                  {new Date(story.publishedAt).toLocaleDateString("en", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </div>
            ) : null}
          </dl>

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {readTarget ? (
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={`/read/${story.id}/${readTarget.id}`}>
                  <BookOpen />
                  {lastRead ? "Continue reading" : "Read now"}
                </Link>
              </Button>
            ) : (
              <Button size="lg" disabled className="w-full sm:w-auto">
                No chapters yet
              </Button>
            )}

            {access.canEdit ? (
              <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                <Link href={`/write/${story.id}`}>
                  <Pencil />
                  Edit story
                </Link>
              </Button>
            ) : null}
          </div>

          <SocialButtons
            className="mt-3"
            storyId={story.id}
            authorId={story.authorId}
            signedIn={Boolean(viewer)}
            initialFavorited={favorites.includes(story.id)}
            initialFollowing={following}
          />
        </div>
      </div>

      {/* Chapter list */}
      <section aria-labelledby="chapters-title" className="space-y-4">
        <h2 id="chapters-title" className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
          Chapters
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {chapters.length} total
          </span>
        </h2>

        {chapters.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground">
            This story has no chapters yet.
          </p>
        ) : (
          <div className="space-y-6">
            {[...chaptersByPart.entries()].map(([partId, list]) => (
              <div key={partId ?? "ungrouped"} className="space-y-2">
                {parts.length > 0 ? (
                  <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {partTitle(partId) || "Chapters"}
                  </h3>
                ) : null}
                <ul className="space-y-2">
                  {list.map((chapter, index) => {
                    const thumb = thumbnailUrl(chapter.thumbnailKey);
                    const count = counts[chapter.id] ?? 0;
                    return (
                      <li key={chapter.id}>
                        <Link
                          href={`/read/${story.id}/${chapter.id}`}
                          className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] tap"
                        >
                          <span className="relative flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <span className="font-serif">{index + 1}</span>
                            )}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">{chapter.title || `Chapter ${index + 1}`}</span>
                            <span className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{formatCount(chapter.wordCount)} words</span>
                              <span className="inline-flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" />
                                {formatCount(count)}
                              </span>
                            </span>
                          </span>
                          {chapter.isLocked ? (
                            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Locked" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Discussion */}
      <CommentThread scope="story" storyId={story.id} title="Story discussion" />

      {/* Related */}
      {related.length > 0 ? (
        <Carousel id="related" title="You may also like">
          {toSummaries(related).map((item) => (
            <div key={item.id} className="w-[9.5rem] shrink-0 snap-start sm:w-44 lg:w-48">
              <StoryCard story={item} />
            </div>
          ))}
        </Carousel>
      ) : null}
    </div>
  );
}
