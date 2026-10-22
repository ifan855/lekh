import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpScope } from "@lekh/core";
import { z } from "zod";

import type { ToolContext, ToolResult } from "../types.js";

export type ToolDef = {
  name: string;
  scope: McpScope;
  description: string;
  register: (server: McpServer, ctx: ToolContext) => void;
};

/**
 * Declare a tool. The zod object schema is converted to JSON Schema by the MCP
 * SDK, so agents get a precise input contract and arguments are validated
 * before the handler runs.
 */
export function defineTool<S extends z.ZodObject<z.ZodRawShape>>(def: {
  name: string;
  scope: McpScope;
  description: string;
  schema: S;
  handler: (args: z.infer<S>, ctx: ToolContext) => Promise<ToolResult>;
}): ToolDef {
  return {
    name: def.name,
    scope: def.scope,
    description: def.description,
    register(server, ctx) {
      server.registerTool(
        def.name,
        { description: def.description, inputSchema: def.schema.shape },
        async (args) => {
          const parsed = def.schema.parse(args ?? {});
          return def.handler(parsed, ctx);
        },
      );
    },
  };
}
