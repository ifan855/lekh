import { NextResponse } from "next/server";

import { db, profiles } from "@lekh/db";
import { eq } from "drizzle-orm";

import { countAdmins, getProfileById } from "@/app/admin/_lib/data";
import { jsonError, readJson, requireAdminApi, str, writeAudit } from "@/app/admin/_lib/server";

const ROLES = ["user", "admin", "banned"] as const;
type Role = (typeof ROLES)[number];

/**
 * POST /api/admin/users/[id]/role  { role: 'user' | 'admin' | 'banned' }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;
  const { id } = await params;

  const body = await readJson(request);
  const role = str(body.role);
  if (!role || !(ROLES as readonly string[]).includes(role)) {
    return jsonError("role must be one of user, admin, banned", 400);
  }
  const nextRole = role as Role;

  const target = await getProfileById(id);
  if (!target) return jsonError("user not found", 404);

  if (nextRole !== "admin" && target.role === "admin") {
    const admins = await countAdmins(id);
    if (admins < 1) return jsonError("cannot remove the last admin", 400);
  }
  if (id === viewer.userId && nextRole !== "admin") {
    return jsonError("you cannot change your own admin role", 400);
  }

  await db.update(profiles).set({ role: nextRole, updatedAt: new Date() }).where(eq(profiles.id, id));

  await writeAudit({
    actorId: viewer.userId,
    action: "user.role",
    targetType: "profile",
    targetId: id,
    meta: { from: target.role, to: nextRole, username: target.username },
  });

  return NextResponse.json({ ok: true, id, role: nextRole });
}
