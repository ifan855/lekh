import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/app/admin/_components/filter-select";
import { Forbidden } from "@/app/admin/_components/forbidden";
import { StoryActions } from "@/app/admin/_components/story-actions";
import { listStories } from "@/app/admin/_lib/data";
import { getAdminViewer } from "@/app/admin/_lib/server";

export const metadata = { title: "Stories · Admin" };

function fmtDate(date: Date | null): string {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(date));
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
}

export default async function AdminStoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getAdminViewer();
  if (!viewer) return <Forbidden />;

  const params = await searchParams;
  const first = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
  };
  const q = first(params.q);
  const status = first(params.status);
  const visibility = first(params.visibility);
  const author = first(params.author);

  const stories = await listStories({ q, status, visibility, author });
  const current = {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(visibility ? { visibility } : {}),
    ...(author ? { author } : {}),
  };

  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search title, author or tag"
          className="h-10 min-w-0 flex-1"
          aria-label="Search stories"
        />
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {visibility ? <input type="hidden" name="visibility" value={visibility} /> : null}
        {author ? <input type="hidden" name="author" value={author} /> : null}
        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
        {q || status || visibility || author ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/stories">Clear</Link>
          </Button>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          name="status"
          value={status}
          label="Status"
          current={current}
          className="h-9 w-[8.5rem] text-xs"
          options={[
            { value: "all", label: "Any status" },
            { value: "published", label: "Published" },
            { value: "draft", label: "Draft" },
          ]}
        />
        <FilterSelect
          name="visibility"
          value={visibility}
          label="Visibility"
          current={current}
          className="h-9 w-[8.5rem] text-xs"
          options={[
            { value: "all", label: "Any visibility" },
            { value: "public", label: "Public" },
            { value: "unlisted", label: "Unlisted" },
            { value: "private", label: "Private" },
          ]}
        />
        <span className="text-xs text-muted-foreground">
          {stories.length} shown{author ? " · filtered by author" : ""}
        </span>
      </div>

      <div className="space-y-2">
        {stories.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No stories matched this filter.
            </CardContent>
          </Card>
        ) : (
          stories.map((story) => (
            <Card key={story.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{story.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      by @{story.authorUsername} · {story.chapterCount} chapters ·{" "}
                      {story.wordCount.toLocaleString()} words · updated {fmtDate(story.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant={story.status === "published" ? "default" : "secondary"}>
                      {story.status}
                    </Badge>
                    <Badge variant="outline">{story.visibility}</Badge>
                    {story.featured ? <Badge>featured</Badge> : null}
                  </div>
                </div>

                {story.tags.length ? (
                  <div className="flex flex-wrap gap-1">
                    {story.tags.map((tag) => (
                      <Link key={tag} href={`/admin/stories?q=${encodeURIComponent(tag)}`}>
                        <Badge variant="muted">#{tag}</Badge>
                      </Link>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{story.readCount.toLocaleString()} reads</span>
                  <span>{story.commentCount.toLocaleString()} comments</span>
                </div>

                <StoryActions
                  storyId={story.id}
                  title={story.title}
                  slug={story.slug}
                  status={story.status}
                  visibility={story.visibility}
                  featured={story.featured}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
