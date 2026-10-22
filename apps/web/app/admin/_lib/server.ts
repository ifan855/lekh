import "server-only";

import { db, auditLog } from "@lekh/db";
import { getViewer, type Viewer } from "@/lib/session";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

/**
 * Access control for the admin panel.
 *
 * The role is ALWAYS resolved from the server-side session (lib/session.ts),
 * never from anything the client sends. Roles live in `profiles.role`:
 *
 *   'user'   -> normal member
 *   'admin'  -> full access to this panel
 *   'banned' -> blocked member (see /admin/users "Ban")
 *
 * A banned member keeps its row (and its id, which is the auth user id) but
 * `profiles.role = 'banned'` marks it as blocked. The sign-in flow must treat
 * any profile whose role is 'banned' as blocked: do not create a session and
 * show "this account has been banned". Admins can restore such a member with
 * the Ban/Unban button, which resets the role back to 'user'.
 */

export type AdminGuard = { ok: true; viewer: Viewer } | { ok: false; response: NextResponse };

/** Server-component guard: redirects anonymous users, returns null for non-admins. */
export async function getAdminViewer(): Promise<Viewer | null> {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/sign-in");
  if (viewer.role !== "admin") return null;
  return viewer;
}

/** Route-handler guard: 401 when anonymous, 403 when not an admin. */
export async function requireAdminApi(): Promise<AdminGuard> {
  const viewer = await getViewer();
  if (!viewer) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }
  if (viewer.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, viewer };
}

export type AuditInput = {
  actorId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
};

/** Append a row to the audit log. Every admin mutation must call this. */
export async function writeAudit(input: AuditInput): Promise<void> {
  await db.insert(auditLog).values({
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    meta: input.meta ?? {},
  });
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Parse a JSON body without throwing. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}
