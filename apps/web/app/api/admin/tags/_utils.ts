import "server-only";

import { db, stories } from "@lekh/db";
import { eq } from "drizzle-orm";

import { storiesWithTag } from "@/app/admin/_lib/data";

/** Replace `from` with `to` in every story that carries it. Returns touched ids. */
export async function applyTagChange(
  from: string,
  to: string | null,
): Promise<{ touched: number }> {
  const affected = await storiesWithTag(from);
  let touched = 0;

  for (const story of affected) {
    const next: string[] = [];
    for (const tag of story.tags) {
      if (tag === from) {
        if (to && !next.includes(to)) next.push(to);
        continue;
      }
      if (!next.includes(tag)) next.push(tag);
    }
    if (to && !next.includes(to)) next.push(to);
    await db.update(stories).set({ tags: next, updatedAt: new Date() }).where(eq(stories.id, story.id));
    touched += 1;
  }

  return { touched };
}

/** Remove `tag` from every story. */
export async function removeTag(tag: string): Promise<{ touched: number }> {
  const affected = await storiesWithTag(tag);
  let touched = 0;

  for (const story of affected) {
    const next = story.tags.filter((value) => value !== tag);
    await db.update(stories).set({ tags: next, updatedAt: new Date() }).where(eq(stories.id, story.id));
    touched += 1;
  }

  return { touched };
}
