import { db, profiles, stories, chapters } from "@lekh/db";
import { and, asc, desc, eq, ilike, inArray, max, count, sql, type SQL } from "drizzle-orm";

const uid = "00000000-0000-0000-0000-000000000001";
const rows = await db
  .select({ id: stories.id, t: stories.title })
  .from(stories)
  .where(and(eq(stories.authorId, uid), ilike(stories.title, "%x%")))
  .orderBy(desc(stories.updatedAt))
  .limit(5);
console.log("select", rows);

const m = await db.select({ v: max(chapters.position) }).from(chapters).where(eq(chapters.storyId, uid));
console.log("max", m);

const c = await db.select({ v: count() }).from(profiles);
console.log("count", c);

const inArr = await db.select({ id: profiles.id }).from(profiles).where(inArray(profiles.id, [uid])).limit(1);
console.log("inArray", inArr);

const raw = await db.execute<{ n: number }>(sql`select count(*)::int as n from profiles`);
console.log("raw", raw[0]);
const raw2 = await db.execute(sql`select 1`);
console.log("raw2", raw2[0]);
process.exit(0);
