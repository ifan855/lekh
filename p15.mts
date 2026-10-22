import { db, profiles } from "@lekh/db";
import { eq } from "drizzle-orm";

const uid = "ee8744da-5b7c-4cd8-98e3-7fa84652fc89";
const t0 = Date.now();
const rows = await db.select().from(profiles).where(eq(profiles.id, uid)).limit(1);
console.log("select by id:", rows.length, Date.now() - t0, "ms");

const base = "lekh-test-probe";
let attempt = 1;
let name = base;
let iterations = 0;
while (await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, name)).limit(1)) {
  iterations++;
  if (iterations > 5) { console.log("LOOPING! current name:", name); break; }
  attempt += 1;
  name = `${base}${attempt}`;
}
console.log("loop done, iterations:", iterations, "final name:", name, Date.now() - t0, "ms");
process.exit(0);
