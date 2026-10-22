import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getChapterContent, getStoryBundle } from "@lekh/core";

import { Reader } from "@/components/reader/reader";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storyId: string; chapterId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { storyId, chapterId } = await params;
  const bundle = await getStoryBundle(storyId);
  if (!bundle) return { title: "Read" };
  const chapter = bundle.chapters.find((item) => item.id === chapterId);
  const title = [chapter?.title, bundle.story.title].filter(Boolean).join(" · ");
  return { title: title || "Read" };
}

export default async function ReadChapterPage({ params }: PageProps) {
  const { storyId, chapterId } = await params;

  const bundle = await getStoryBundle(storyId);
  if (!bundle) notFound();

  const chapter = await getChapterContent(chapterId);
  if (!chapter || chapter.storyId !== storyId) notFound();

  const viewer = await getViewer();
  const locked = chapter.isLocked && viewer?.userId !== bundle.story.authorId;

  return (
    <Reader
      locked={locked}
      story={{
        id: bundle.story.id,
        slug: bundle.story.slug,
        title: bundle.story.title,
        description: bundle.story.description,
        language: bundle.story.language,
        authorName: bundle.story.authorName,
        authorUsername: bundle.story.authorUsername,
        coverKey: bundle.story.coverKey,
        coverColor: bundle.story.coverColor,
      }}
      chapter={{
        id: chapter.id,
        title: chapter.title,
        position: chapter.position,
        wordCount: chapter.wordCount,
        content: chapter.content,
      }}
      chapters={bundle.chapters.map((item) => ({
        id: item.id,
        partId: item.partId,
        title: item.title,
        position: item.position,
        wordCount: item.wordCount,
        isLocked: item.isLocked,
      }))}
      parts={bundle.parts.map((part) => ({
        id: part.id,
        title: part.title,
        position: part.position,
      }))}
    />
  );
}
