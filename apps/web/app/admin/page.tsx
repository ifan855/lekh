import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getAdminViewer } from "@/app/admin/_lib/server";
import { getStats, listStories, listUsers } from "@/app/admin/_lib/data";
import { Forbidden } from "@/app/admin/_components/forbidden";

function fmtDate(date: Date | null | undefined): string {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(date));
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
}

export default async function AdminDashboardPage() {
  const viewer = await getAdminViewer();
  if (!viewer) return <Forbidden />;

  const [stats, recentUsers, recentStories] = await Promise.all([
    getStats(),
    listUsers({ limit: 6 }),
    listStories({ limit: 6 }),
  ]);

  const tiles = [
    { label: "Members", value: stats.users, href: "/admin/users" },
    { label: "Admins", value: stats.admins, href: "/admin/users?role=admin" },
    { label: "Banned", value: stats.banned, href: "/admin/users?role=banned" },
    { label: "Stories", value: stats.stories, href: "/admin/stories" },
    { label: "Published", value: stats.published, href: "/admin/stories?status=published" },
    { label: "Drafts", value: stats.drafts, href: "/admin/stories?status=draft" },
    { label: "Comments", value: stats.comments, href: "/admin/comments" },
    { label: "Reads", value: stats.reads, href: "/admin" },
    { label: "OCR jobs", value: stats.ocrJobs, href: "/admin" },
    { label: "Open reports", value: stats.openReports, href: "/admin/comments" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{tile.label}</p>
                <p className="text-2xl font-semibold tabular-nums">{tile.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {stats.ocrFailed > 0 ? (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <Badge variant="destructive">{stats.ocrFailed} failed</Badge>
            <span className="text-muted-foreground">
              OCR jobs failed — check the vision provider in{" "}
              <Link className="underline" href="/admin/settings">
                settings
              </Link>
              .
            </span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent sign-ups</CardTitle>
            <CardDescription className="text-xs">Newest members of lekh</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {recentUsers.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">No members yet.</li>
              ) : (
                recentUsers.map((user) => (
                  <li key={user.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{user.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{user.username} · joined {fmtDate(user.createdAt)}
                      </p>
                    </div>
                    <Badge variant={user.role === "admin" ? "default" : user.role === "banned" ? "destructive" : "muted"}>
                      {user.role}
                    </Badge>
                  </li>
                ))
              )}
            </ul>
            <Separator />
            <div className="p-3">
              <Button asChild size="sm" variant="ghost">
                <Link href="/admin/users">All members →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent stories</CardTitle>
            <CardDescription className="text-xs">Newest uploads</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {recentStories.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">No stories yet.</li>
              ) : (
                recentStories.map((story) => (
                  <li key={story.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{story.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        by @{story.authorUsername} · {fmtDate(story.createdAt)}
                      </p>
                    </div>
                    <Badge variant={story.status === "published" ? "default" : "secondary"}>
                      {story.status}
                    </Badge>
                    {story.featured ? <Badge>featured</Badge> : null}
                  </li>
                ))
              )}
            </ul>
            <Separator />
            <div className="p-3">
              <Button asChild size="sm" variant="ghost">
                <Link href="/admin/stories">All stories →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quick links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/users">Manage users</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/stories">Moderate stories</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/comments">Comment queue</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/tags">Taxonomy</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/settings">Site &amp; vision settings</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/audit">Audit log</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
