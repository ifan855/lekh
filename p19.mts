import { db, profiles } from "@lekh/db";
import { eq, sql } from "drizzle-orm";

const name = "lekh-test-probe";
const q = db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, name)).limit(1);
console.log("SQL:", q.toSQL().sql, JSON.stringify(q.toSQL().params));
const rows = await q;
console.log("rows:", JSON.stringify(rows));

const q2 = db.select({ id: profiles.id, u: profiles.username }).from(profiles).where(eq(profiles.username, name));
console.log("SQL2:", q2.toSQL().sql, JSON.stringify(q2.toSQL().params));
console.log("rows2:", JSON.stringify(await q2));
process.exit(0);
