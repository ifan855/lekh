import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { registerTools } from "./tools/index.js";
import type { ToolContext } from "./types.js";

export const SERVER_NAME = "lekh";
export const SERVER_VERSION = "0.1.0";

const INSTRUCTIONS = `lekh is a writing workspace. Use list_stories to find the user's stories, get_draft to
plan, write_blocks (or create_chapter / update_chapter) to write prose, and publish_story when the
story is ready. This server can only read and write stories: it has no tools for comments, votes,
follows, favourites, notifications or profiles.`;

export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );
  registerTools(server, ctx);
  return server;
}

export type TransportMode = "stateful" | "stateless";

export type TransportHooks = {
  onsessioninitialized?: (sessionId: string) => void | Promise<void>;
  onsessionclosed?: (sessionId: string) => void | Promise<void>;
};

export function createTransport(
  mode: TransportMode,
  hooks: TransportHooks = {},
): WebStandardStreamableHTTPServerTransport {
  if (mode === "stateful") {
    return new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: hooks.onsessioninitialized,
      onsessionclosed: hooks.onsessionclosed,
    });
  }
  return new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    onsessioninitialized: hooks.onsessioninitialized,
    onsessionclosed: hooks.onsessionclosed,
  });
}
