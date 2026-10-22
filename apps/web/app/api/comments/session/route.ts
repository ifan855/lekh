import { getViewer } from "@/lib/session";

import type { CommentSession } from "@/components/comments/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/comments/session
 * Tiny helper so client components know who they are (and whether they are
 * signed in) without pulling the whole auth client into the bundle.
 */
export async function GET(): Promise<Response> {
  const viewer = await getViewer();
  const payload: CommentSession = {
    signedIn: Boolean(viewer),
    user: viewer
      ? {
          id: viewer.userId,
          username: viewer.username,
          displayName: viewer.displayName,
          avatarKey: viewer.avatarKey,
          role: viewer.role,
        }
      : null,
  };
  return Response.json(payload);
}
