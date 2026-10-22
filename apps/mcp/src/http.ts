import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { hasScope, type McpPrincipal } from "@lekh/core";

import { authenticate } from "./auth.js";
import { createMcpServer, createTransport } from "./server.js";
import { requiredScope } from "./tools/index.js";
import type { ToolContext } from "./types.js";

type Session = {
  id: string;
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  principal: McpPrincipal;
  createdAt: number;
};

/** In-memory MCP sessions (one per client connection). */
const sessions = new Map<string, Session>();
const MAX_SESSIONS = 500;
const SESSION_TTL_MS = 30 * 60 * 1000;

function jsonRpcError(
  id: string | number | null,
  status: number,
  code: number,
  message: string,
): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pruneSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
  while (sessions.size > MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (!oldest) break;
    sessions.delete(oldest[0]);
    void oldest[1].transport.close();
  }
}

type JsonRpcMessage = {
  method?: unknown;
  id?: unknown;
  params?: { name?: unknown } | undefined;
};

function messagesOf(parsed: unknown): JsonRpcMessage[] {
  if (Array.isArray(parsed)) return parsed as JsonRpcMessage[];
  if (parsed && typeof parsed === "object") return [parsed as JsonRpcMessage];
  return [];
}

function isInitialize(parsed: unknown): boolean {
  return messagesOf(parsed).some((message) => message.method === "initialize");
}

/** A tools/call for a tool the key is not allowed to use. */
function checkScope(
  parsed: unknown,
  principal: McpPrincipal,
): { id: string | number | null; message: string } | null {
  for (const message of messagesOf(parsed)) {
    if (message.method !== "tools/call") continue;
    const name = message.params?.name;
    if (typeof name !== "string") continue;
    const scope = requiredScope(name);
    if (!scope) continue;
    if (hasScope(principal, scope)) continue;
    const id =
      typeof message.id === "string" || typeof message.id === "number" ? message.id : null;
    const owned = principal.scopes.length > 0 ? principal.scopes.join(", ") : "none";
    return {
      id,
      message: `Forbidden: tool '${name}' requires the '${scope}' scope. This key has: ${owned}.`,
    };
  }
  return null;
}

/** Rebuild the request for the transport (the body was already read). */
function toTransportRequest(request: Request, rawBody?: string): Request {
  const headers = new Headers(request.headers);
  const accept = headers.get("accept") ?? "";
  if (!accept.includes("text/event-stream")) {
    headers.set("accept", accept.includes("application/json")
      ? "application/json, text/event-stream"
      : "application/json, text/event-stream");
  }
  if (request.method === "POST") {
    headers.delete("content-length");
    if (!headers.get("content-type")) headers.set("content-type", "application/json");
    return new Request(request.url, { method: "POST", headers, body: rawBody ?? "" });
  }
  return new Request(request.url, { method: request.method, headers });
}

/** Handle one MCP request (POST for JSON-RPC, GET for the SSE stream, DELETE to end a session). */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth.ok) {
    return jsonRpcError(null, auth.status, -32001, auth.message);
  }

  const ctx: ToolContext = {
    principal: auth.principal,
    viewer: { id: auth.principal.userId, role: auth.role },
  };

  let parsed: unknown;
  let rawBody: string | undefined;

  if (request.method === "POST") {
    rawBody = await request.text();
    if (rawBody.trim().length === 0) {
      return jsonRpcError(null, 400, -32700, "Empty request body.");
    }
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return jsonRpcError(null, 400, -32700, "Invalid JSON body.");
    }

    const denial = checkScope(parsed, auth.principal);
    if (denial) {
      return jsonRpcError(denial.id, 403, -32001, denial.message);
    }
  }

  const sessionId = request.headers.get("mcp-session-id");

  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      return jsonRpcError(
        null,
        404,
        -32001,
        `MCP session ${sessionId} is unknown or expired. Send an initialize request to start a new session.`,
      );
    }
    if (session.principal.userId !== auth.principal.userId) {
      return jsonRpcError(null, 403, -32001, "This MCP session belongs to a different user.");
    }
    return session.transport.handleRequest(toTransportRequest(request, rawBody), {
      parsedBody: parsed,
    });
  }

  if (isInitialize(parsed)) {
    const server = createMcpServer(ctx);
    let transport: WebStandardStreamableHTTPServerTransport;
    transport = createTransport("stateful", {
      onsessioninitialized: (id) => {
        pruneSessions();
        sessions.set(id, {
          id,
          server,
          transport,
          principal: auth.principal,
          createdAt: Date.now(),
        });
      },
      onsessionclosed: (id) => {
        sessions.delete(id);
      },
    });
    await server.connect(transport);
    return transport.handleRequest(toTransportRequest(request, rawBody), { parsedBody: parsed });
  }

  // No session: serve the request statelessly (one server per request).
  const server = createMcpServer(ctx);
  const transport = createTransport("stateless");
  await server.connect(transport);
  return transport.handleRequest(toTransportRequest(request, rawBody), { parsedBody: parsed });
}
