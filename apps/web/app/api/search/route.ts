import { NextResponse } from "next/server";

import { searchStories } from "@lekh/core";

export const dynamic = "force-dynamic";

/**
 * Live search endpoint used by the search bar's suggestion dropdown.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < 2) {
    return NextResponse.json({ query, results: [] });
  }

  const stories = await searchStories(query, 8);

  return NextResponse.json({
    query,
    results: stories.map((story) => ({
      id: story.id,
      title: story.title,
      authorName: story.authorName,
      authorUsername: story.authorUsername,
      tags: story.tags ?? [],
    })),
  });
}
