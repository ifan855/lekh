import { createHash, randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@lekh/db";
import { mcpTokens } from "@lekh/db";

export type McpScope = "read" | "write" | "admin";

export const MCP_SCOPES: McpScope[] = ["read", "write", "admin"];

export function generateMcpToken(): { token: string; hash: string } {
  const token = `lkh_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueMcpToken(
  userId: string,
  name: string,
  scopes: McpScope[],
): Promise<{ id: string; token: string }> {
  const { token, hash } = generateMcpToken();
  const rows = await db
    .insert(mcpTokens)
    .values({
      userId,
      name,
      tokenHash: hash,
      scopes: scopes.join(","),
    })
    .returning({ id: mcpTokens.id });
  return { id: rows[0].id, token };
}

export async function listMcpTokens(userId: string) {
  return db.select().from(mcpTokens).where(eq(mcpTokens.userId, userId)).orderBy(mcpTokens.createdAt);
}

export async function revokeMcpToken(userId: string, id: string): Promise<void> {
  await db
    .update(mcpTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(mcpTokens.id, id), eq(mcpTokens.userId, userId)));
}

export type McpPrincipal = {
  userId: string;
  tokenId: string;
  scopes: McpScope[];
};

/** Resolve a bearer token into a principal, or null. */
export async function resolveMcpToken(token: string | undefined | null): Promise<McpPrincipal | null> {
  if (!token) return null;
  const hash = hashToken(token.trim());
  const rows = await db
    .select()
    .from(mcpTokens)
    .where(and(eq(mcpTokens.tokenHash, hash), isNull(mcpTokens.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  await db.update(mcpTokens).set({ lastUsedAt: new Date() }).where(eq(mcpTokens.id, row.id));
  const scopes = (row.scopes || "read")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as McpScope[];
  return { userId: row.userId, tokenId: row.id, scopes };
}

export function hasScope(principal: McpPrincipal, scope: McpScope): boolean {
  return principal.scopes.includes(scope) || principal.scopes.includes("admin");
}
