import type { McpPrincipal, McpScope } from "@lekh/core";

/** The authenticated caller of a tool. */
export type ToolContext = {
  principal: McpPrincipal;
  /** Viewer used for story permission checks (owner / co-author / admin). */
  viewer: { id: string; role: "user" | "admin" };
};

/** Text-only tool result (the MCP SDK also supports images, we do not need them). */
export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export type { McpScope };

export function text(value: string): ToolResult {
  return { content: [{ type: "text", text: value }] };
}

export function textResult(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}
