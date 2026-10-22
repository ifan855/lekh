import postgres from "postgres";
const sql = postgres("postgresql://neondb_owner:npg_Ljc6MF2CaqUx@ep-quiet-wave-b4plfvuw.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require", { prepare: false });
const a = await sql`select id, username from public.profiles where username = ${"lekh-test-probe"} limit 1`;
console.log("raw postgres.js:", JSON.stringify(a));
const b = await sql`select id, username from public.profiles where username = ${"mira"} limit 1`;
console.log("raw 'mira':", JSON.stringify(b));
const c = await sql`select id, username, username = ${"lekh-test-probe"} as eq_test from public.profiles`;
console.log("compare:", JSON.stringify(c));
await sql.end();
