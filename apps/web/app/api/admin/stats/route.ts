import { NextResponse } from "next/server";

import { getStats } from "@/app/admin/_lib/data";
import { requireAdminApi } from "@/app/admin/_lib/server";

/** GET /api/admin/stats — headline counters for the dashboard. */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const stats = await getStats();
  return NextResponse.json({ ok: true, stats });
}
