import { resolveMcpToken, type McpPrincipal } from "@lekh/core";
import { db, profiles } from "@lekh/db";
import { eq } from "drizzle-orm";

export type AuthFailure = { ok: false; status: 401 | 403; message: string };
export type AuthSuccess = {
  ok: true;
  principal: McpPrincipal;
  role: "user" | "admin";
};
export type AuthResult = AuthSuccess | AuthFailure;

/** Extract the bearer token from an `Authorization: Bearer <token>` header. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/** The profile role decides whether a key may act as an admin. */
export async function roleOf(userId: string): Promise<"user" | "admin"> {
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return rows[0]?.role === "admin" ? "admin" : "user";
}

/**
 * Authenticate an MCP request. Every call resolves the bearer token against
 * the `mcp_tokens` table (hash comparison) — an unknown or revoked token is a
 * 401.
 */
export async function authenticate(request: Request): Promise<AuthResult> {
  const token = bearerToken(request);
  if (!token) {
    return {
      ok: false,
      status: 401,
      message:
        "Missing MCP key. Send 'Authorization: Bearer <token>' with a key created in lekh settings (Settings → MCP keys).",
    };
  }

  const principal = await resolveMcpToken(token);
  if (!principal) {
    return {
      ok: false,
      status: 401,
      message: "Invalid or revoked MCP key.",
    };
  }

  const role = await roleOf(principal.userId);
  return { ok: true, principal, role };
}
