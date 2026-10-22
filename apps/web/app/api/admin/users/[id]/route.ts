import { NextResponse } from "next/server";

import { db, profiles } from "@lekh/db";
import { eq } from "drizzle-orm";

import { countAdmins, getProfileById } from "@/app/admin/_lib/data";
import { jsonError, requireAdminApi, writeAudit } from "@/app/admin/_lib/server";

/**
 * DELETE /api/admin/users/[id]
 *
 * Hard delete: the profile row is removed and every story, chapter, comment
 * and follow that belongs to it is removed too (foreign keys cascade). The
 * panel asks for an explicit confirmation before calling this.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;
  const { id } = await params;

  const target = await getProfileById(id);
  if (!target) return jsonError("user not found", 404);

  if (id === viewer.userId) return jsonError("you cannot delete your own account", 400);

  if (target.role === "admin") {
    const admins = await countAdmins(id);
    if (admins < 1) return jsonError("cannot delete the last admin", 400);
  }

  await db.delete(profiles).where(eq(profiles.id, id));

  await writeAudit({
    actorId: viewer.userId,
    action: "user.delete",
    targetType: "profile",
    targetId: id,
    meta: { username: target.username, displayName: target.displayName, role: target.role },
  });

  return NextResponse.json({ ok: true, id });
}
