import postgres from "postgres";
const sql = postgres("postgresql://neondb_owner:npg_Ljc6MF2CaqUx@ep-quiet-wave-b4plfvuw.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require");
const rows = await sql`select id, username, display_name, role, created_at from public.profiles order by created_at desc limit 12`;
for (const r of rows) console.log(JSON.stringify(r));
const c = await sql`select count(*)::int as n from public.profiles`;
console.log("total profiles:", c[0].n);
await sql.end();
