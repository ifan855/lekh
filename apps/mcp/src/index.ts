import { Hono } from "hono";
import { cors } from "hono/cors";

import { handleMcpRequest } from "./http.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "authorization",
      "content-type",
      "accept",
      "mcp-session-id",
      "mcp-protocol-version",
      "last-event-id",
    ],
    exposeHeaders: ["mcp-session-id"],
    maxAge: 86400,
  }),
);

app.get("/health", (c) =>
  c.json({ ok: true, service: "lekh-mcp", version: "0.1.0" }),
);

app.get("/", (c) =>
  c.json({
    service: "lekh-mcp",
    transport: "streamable-http",
    endpoint: "/mcp",
    auth: "Authorization: Bearer <mcp key>",
    hint: "Create a key at /settings/mcp in the lekh web app.",
  }),
);

/** The MCP endpoint: POST for JSON-RPC, GET for the SSE stream, DELETE to end a session. */
app.all("/mcp", (c) => handleMcpRequest(c.req.raw));

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default {
  /**
   * Neon Functions entry point: a module whose default export has a `fetch`
   * method. `app.fetch` is re-exported through a wrapper so it keeps its `this`.
   */
  fetch(request: Request, env?: unknown, executionCtx?: unknown) {
    return app.fetch(request, env as never, executionCtx as never);
  },
};
