import { NextResponse } from "next/server";

import { db, profiles } from "@lekh/db";
import { sql as drizzleSql } from "drizzle-orm";
import { eq } from "drizzle-orm";

import { countAdmins, getProfileById } from "@/app/admin/_lib/data";
import { bool, jsonError, readJson, requireAdminApi, writeAudit } from "@/app/admin/_lib/server";

/**
 * POST /api/admin/users/[id]/ban  { banned?: boolean }
 *
 * There is no `bannedAt` column: a ban is expressed as `profiles.role =
 * 'banned'`. The sign-in flow must treat that role as blocked (no session is
 * created for it). Un-banning restores the member to the plain 'user' role
 * (admins keep 'admin').
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { viewer } = guard;
  const { id } = await params;

  const body = await readJson(request);
  const banned = bool(body.banned) ?? true;

  const target = await getProfileById(id);
  if (!target) return jsonError("user not found", 404);

  if (id === viewer.userId) return jsonError("you cannot ban yourself", 400);

  if (banned && target.role === "admin") {
    const admins = await countAdmins(id);
    if (admins < 1) return jsonError("cannot ban the last admin", 400);
  }

  const nextRole = banned ? "banned" : target.role === "admin" ? "admin" : "user";
  await db.update(profiles).set({ role: nextRole, updatedAt: new Date() }).where(eq(profiles.id, id));

  // Best effort: mirror the ban in the auth schema when it is reachable.
  try {
    await db.execute(
      drizzleSql`update neon_auth."user" set banned = ${banned}, "banReason" = ${banned ? "banned by an admin" : null} where id = ${id}::uuid`,
    );
  } catch {
    /* auth schema not reachable — the profile role still blocks the member */
  }

  await writeAudit({
    actorId: viewer.userId,
    action: banned ? "user.ban" : "user.unban",
    targetType: "profile",
    targetId: id,
    meta: { username: target.username, from: target.role, to: nextRole },
  });

  return NextResponse.json({ ok: true, id, role: nextRole, banned });
}
