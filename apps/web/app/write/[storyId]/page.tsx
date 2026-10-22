import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink, PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStoryAccess } from "@lekh/core";
import { db, stories } from "@lekh/db";

import { ChapterManager } from "@/components/writer/chapter-manager";
import { StoryDetailsForm } from "@/components/writer/story-details-form";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StoryManagerPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold">Sign in to write</h1>
        <Button asChild className="mt-6">
          <Link href="/auth/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  }

  const rows = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  const story = rows[0];
  if (!story) notFound();

  const access = await getStoryAccess(story, viewer);
  if (!access.canEdit) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold">This story is not yours to edit</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You can still read it if it is published.
        </p>
        <Button asChild className="mt-6">
          <Link href={`/story/${story.id}`}>Open story</Link>
        </Button>
      </div>
    );
  }

  const { getStoryBundle } = await import("@lekh/core");
  const bundle = await getStoryBundle(storyId);
  const chapters = bundle?.chapters ?? [];
  const partRows = bundle?.parts ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/write">
            <ArrowLeft className="h-4 w-4" />
            Stories
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-serif text-xl font-semibold tracking-tight md:text-2xl">
            {story.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={story.status === "published" ? "secondary" : "muted"}>
              {story.status}
            </Badge>
            <Badge variant="outline">{story.visibility}</Badge>
            <span>{chapters.length} chapters</span>
            <span>{story.wordCount.toLocaleString()} words</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/story/${story.id}`} target="_blank">
              <ExternalLink className="h-4 w-4" />
              View
            </Link>
          </Button>
          {chapters.length > 0 && (
            <Button asChild size="sm">
              <Link href={`/write/${story.id}/${chapters[0].id}`}>
                <PenLine className="h-4 w-4" />
                Open editor
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="chapters">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="chapters">
          <ChapterManager
            storyId={story.id}
            initialChapters={chapters.map((c) => ({
              id: c.id,
              title: c.title,
              position: c.position,
              partId: c.partId,
              wordCount: c.wordCount,
              thumbnailKey: c.thumbnailKey,
              updatedAt: c.updatedAt.toISOString(),
            }))}
            initialParts={partRows.map((p) => ({
              id: p.id,
              title: p.title,
              position: p.position,
            }))}
          />
        </TabsContent>

        <TabsContent value="details">
          <StoryDetailsForm
            story={{
              id: story.id,
              title: story.title,
              description: story.description,
              language: story.language,
              visibility: story.visibility as "public" | "unlisted" | "private",
              status: story.status as "draft" | "published",
              tags: story.tags,
              fontPreset: story.fontPreset,
              coverKey: story.coverKey,
              isCompleted: story.isCompleted,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
