import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getStoryAccess } from "@lekh/core";
import { chapters, stories } from "@lekh/db";
import { db } from "@lekh/db";

import { WriterEditor } from "@/components/writer/editor";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ storyId: string; chapterId: string }>;
}) {
  const { storyId, chapterId } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/sign-in");

  const storyRows = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  const story = storyRows[0];
  if (!story) notFound();

  const access = await getStoryAccess(story, viewer);
  if (!access.canEdit) redirect(`/story/${storyId}`);

  const chapterRows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1);
  const chapter = chapterRows[0];
  if (!chapter || chapter.storyId !== storyId) notFound();

  const siblings = await db
    .select({ id: chapters.id, title: chapters.title, position: chapters.position })
    .from(chapters)
    .where(eq(chapters.storyId, storyId))
    .orderBy(asc(chapters.position));

  const index = siblings.findIndex((c) => c.id === chapterId);
  const next = siblings[index + 1];
  const prev = siblings[index - 1];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex items-center gap-2 border-b px-4 py-2 md:px-10">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/write/${storyId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <span className="truncate text-xs text-muted-foreground">{story.title}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {index + 1} / {siblings.length}
        </span>
      </div>

      <WriterEditor
        chapterId={chapter.id}
        initialContent={chapter.content}
        initialTitle={chapter.title}
        initialUpdatedAt={chapter.updatedAt.toISOString()}
        fontPreset={story.fontPreset}
        onFontPresetChange={async (preset) => {
          await fetch(`/api/stories/${storyId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ fontPreset: preset }),
          });
        }}
      />

      <div className="flex items-center justify-between border-t px-4 py-3 text-sm md:px-10">
        {prev ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/write/${storyId}/${prev.id}`}>← Previous</Link>
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/write/${storyId}/${next.id}`}>Next →</Link>
          </Button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
