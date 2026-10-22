import { db, comments, profiles, stories } from "@lekh/db";
import { count } from "drizzle-orm";
import { z } from "zod";

import { textResult } from "../types.js";
import { defineTool, type ToolDef } from "./define.js";

const adminStats = defineTool({
  name: "admin_stats",
  scope: "admin",
  description:
    "Platform counters for admins: how many users, stories and comments exist. Requires an admin key; other keys get a 403.",
  schema: z.object({}),
  handler: async () => {
    const [users, storyRows, commentRows] = await Promise.all([
      db.select({ value: count() }).from(profiles),
      db.select({ value: count() }).from(stories),
      db.select({ value: count() }).from(comments),
    ]);
    return textResult({
      users: Number(users[0]?.value ?? 0),
      stories: Number(storyRows[0]?.value ?? 0),
      comments: Number(commentRows[0]?.value ?? 0),
    });
  },
});

export const adminTools: ToolDef[] = [adminStats];
