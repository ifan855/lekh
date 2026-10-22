import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { BookMarked } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { db, favorites, profiles, stories } from "@lekh/db";
import { and } from "drizzle-orm";

import { getViewer } from "@/lib/session";
import { coverGradient } from "@/lib/cover";
import { formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/sign-in?next=/library");

  const rows = await db
    .select({
      id: stories.id,
      title: stories.title,
      coverKey: stories.coverKey,
      readCount: stories.readCount,
      chapterCount: stories.chapterCount,
      status: stories.status,
      visibility: stories.visibility,
      authorName: profiles.displayName,
      createdAt: favorites.createdAt,
    })
    .from(favorites)
    .innerJoin(stories, eq(stories.id, favorites.storyId))
    .innerJoin(profiles, eq(profiles.id, stories.authorId))
    .where(eq(favorites.userId, viewer.userId))
    .orderBy(desc(favorites.createdAt));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Your library</h1>
      <p className="mt-1 text-sm text-muted-foreground">Stories you saved for later.</p>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed p-10 text-center">
          <BookMarked className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing saved yet. Tap the bookmark on any story to keep it here.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-primary underline">
            Find something to read
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/story/${row.id}`}
                className="tap flex gap-4 rounded-xl border bg-card p-3 shadow-sm hover:bg-accent/40"
              >
                <span
                  className="flex h-24 w-16 shrink-0 items-end rounded-md p-1.5 text-[10px] font-medium text-white/90"
                  style={{ background: coverGradient(row.id) }}
                >
                  <span className="line-clamp-3">{row.title}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif font-semibold">{row.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{row.authorName}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="muted">{row.chapterCount} ch</Badge>
                    <span>{formatCount(row.readCount)} reads</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
