import { db } from "@lekh/db";
import { sql } from "drizzle-orm";

/** Where the agent last wrote inside a chapter. */
export type SessionCursor = {
  blockId?: string;
  offset?: number;
  at?: string;
};

export type McpSessionRow = {
  id: string;
  user_id: string;
  story_id: string;
  chapter_id: string;
  status: "open" | "closed";
  cursor: SessionCursor | null;
  created_at: Date;
  updated_at: Date;
};

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS mcp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  story_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open',
  cursor jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_sessions_user_idx ON mcp_sessions (user_id, created_at DESC);
`;

let tablePromise: Promise<void> | null = null;

/**
 * The `mcp_sessions` table is created lazily the first time a session tool is
 * used, so no migration is required to run the server.
 */
export function ensureMcpSessionsTable(): Promise<void> {
  if (!tablePromise) {
    tablePromise = db
      .execute(CREATE_TABLE)
      .then(() => undefined)
      .catch((error: unknown) => {
        tablePromise = null;
        throw error;
      });
  }
  return tablePromise;
}

export async function insertSession(input: {
  userId: string;
  storyId: string;
  chapterId: string;
}): Promise<McpSessionRow> {
  await ensureMcpSessionsTable();
  const rows = await db.execute<McpSessionRow>(sql`
    insert into mcp_sessions (user_id, story_id, chapter_id, status)
    values (${input.userId}, ${input.storyId}, ${input.chapterId}, 'open')
    returning id, user_id, story_id, chapter_id, status, cursor, created_at, updated_at
  `);
  const row = rows[0];
  if (!row) throw new Error("Could not create the editing session.");
  return row;
}

export async function getSession(id: string): Promise<McpSessionRow | null> {
  await ensureMcpSessionsTable();
  const rows = await db.execute<McpSessionRow>(sql`
    select id, user_id, story_id, chapter_id, status, cursor, created_at, updated_at
    from mcp_sessions
    where id = ${id}
    limit 1
  `);
  return rows[0] ?? null;
}

export async function listSessions(
  userId: string,
  options: { status?: "open" | "closed"; limit?: number } = {},
): Promise<McpSessionRow[]> {
  await ensureMcpSessionsTable();
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  if (options.status) {
    return db.execute<McpSessionRow>(sql`
      select id, user_id, story_id, chapter_id, status, cursor, created_at, updated_at
      from mcp_sessions
      where user_id = ${userId} and status = ${options.status}
      order by created_at desc
      limit ${limit}
    `);
  }
  return db.execute<McpSessionRow>(sql`
    select id, user_id, story_id, chapter_id, status, cursor, created_at, updated_at
    from mcp_sessions
    where user_id = ${userId}
    order by created_at desc
    limit ${limit}
  `);
}

export async function closeSession(id: string, userId: string): Promise<McpSessionRow | null> {
  await ensureMcpSessionsTable();
  const rows = await db.execute<McpSessionRow>(sql`
    update mcp_sessions
    set status = 'closed', updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning id, user_id, story_id, chapter_id, status, cursor, created_at, updated_at
  `);
  return rows[0] ?? null;
}

export async function setSessionCursor(
  id: string,
  userId: string,
  cursor: SessionCursor,
): Promise<McpSessionRow | null> {
  await ensureMcpSessionsTable();
  const rows = await db.execute<McpSessionRow>(sql`
    update mcp_sessions
    set cursor = ${JSON.stringify(cursor)}::jsonb, updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning id, user_id, story_id, chapter_id, status, cursor, created_at, updated_at
  `);
  return rows[0] ?? null;
}
