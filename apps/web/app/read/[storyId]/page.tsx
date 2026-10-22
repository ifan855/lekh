import { notFound, redirect } from "next/navigation";

import { getStoryBundle } from "@lekh/core";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ storyId: string }>;
};

/** `/read/<storyId>` always lands on the first chapter of the story. */
export default async function ReadStoryRedirect({ params }: PageProps) {
  const { storyId } = await params;

  const bundle = await getStoryBundle(storyId);
  if (!bundle) notFound();

  const first = bundle.chapters[0];
  if (!first) notFound();

  redirect(`/read/${storyId}/${first.id}`);
}
