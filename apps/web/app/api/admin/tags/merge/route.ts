import { NextResponse } from "next/server";

import { applyTagChange } from "@/app/api/admin/tags/_utils";
import { jsonError, readJson, requireAdminApi, str, writeAudit } from "@/app/admin/_lib/server";

/**
 * POST /api/admin/tags/merge  { from, to }
 *
 * Folds the tag `from` into the tag `to`: every story tagged `from` ends up
 * tagged `to` only (the duplicate `to` is collapsed).
 */
export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;

  const body = await readJson(request);
  const from = str(body.from);
  const to = str(body.to);
  if (!from || !to) return jsonError("from and to are required", 400);
  if (from === to) return jsonError("from and to must differ", 400);

  const { touched } = await applyTagChange(from, to);

  await writeAudit({
    actorId: viewer.userId,
    action: "tag.merge",
    targetType: "tag",
    targetId: from,
    meta: { from, to, stories: touched },
  });

  return NextResponse.json({ ok: true, from, to, stories: touched });
}
