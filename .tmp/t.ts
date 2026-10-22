import { db, profiles } from "@lekh/db";
import { eq } from "drizzle-orm";

const rows = await db.select({ id: profiles.id, role: profiles.role }).from(profiles).where(eq(profiles.role, "admin")).limit(1);
console.log("rows", rows);
process.exit(0);
