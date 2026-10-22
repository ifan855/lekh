import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { hasScope, type McpScope } from "@lekh/core";

import type { ToolContext } from "../types.js";
import { adminTools } from "./admin.js";
import type { ToolDef } from "./define.js";
import { readTools } from "./read.js";
import { sessionTools } from "./session.js";
import { writeTools } from "./write.js";

/**
 * Every tool the server exposes. There are deliberately no comment, vote,
 * follow, favourite, notification or profile tools — the MCP server can only
 * read and write stories.
 */
export const allTools: ToolDef[] = [
  ...readTools,
  ...writeTools,
  ...sessionTools,
  ...adminTools,
];

export const toolScopes: Record<string, McpScope> = Object.fromEntries(
  allTools.map((tool) => [tool.name, tool.scope]),
);

export function registerTools(server: McpServer, ctx: ToolContext): void {
  for (const tool of allTools) {
    tool.register(server, ctx);
  }
}

/** The scope a tool needs, or null when the tool does not exist. */
export function requiredScope(toolName: string): McpScope | null {
  return toolScopes[toolName] ?? null;
}

/** True when the key may use the tool. */
export function canUseTool(ctx: ToolContext, toolName: string): boolean {
  const scope = requiredScope(toolName);
  if (!scope) return true;
  return hasScope(ctx.principal, scope);
}
