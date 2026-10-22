import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export * from "./schema";

/**
 * Postgres client for lekh.
 *
 * Uses the direct (non-pooler) endpoint by default because Next.js route
 * handlers and the MCP server run on Node with `pg`-style drivers that do not
 * negotiate TLS channel binding. Set DATABASE_URL to the pooled URI if your
 * deployment needs it.
 */
const globalForDb = globalThis as unknown as { lekhSql?: postgres.Sql };

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in the Neon connection string.",
    );
  }
  return url;
}

export const sql =
  globalForDb.lekhSql ??
  postgres(connectionString(), {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.lekhSql = sql;
}

export const db = drizzle(sql, { schema });

export type Database = typeof db;
