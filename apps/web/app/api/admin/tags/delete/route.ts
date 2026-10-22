import { NextResponse } from "next/server";

import { removeTag } from "@/app/api/admin/tags/_utils";
import { jsonError, readJson, requireAdminApi, str, writeAudit } from "@/app/admin/_lib/server";

/** POST /api/admin/tags/delete  { tag } — removes a tag from every story. */
export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;

  const body = await readJson(request);
  const tag = str(body.tag);
  if (!tag) return jsonError("tag is required", 400);

  const { touched } = await removeTag(tag);

  await writeAudit({
    actorId: viewer.userId,
    action: "tag.delete",
    targetType: "tag",
    targetId: tag,
    meta: { tag, stories: touched },
  });

  return NextResponse.json({ ok: true, tag, stories: touched });
}
