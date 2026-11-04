import { connection, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/db/admin";

/**
 * GET /api/health (Phase 22a): is the app up, and does the database answer? For the
 * uptime monitor (Better Stack). 200 `{ status: "ok", db: "ok" | "off" }`, 503 when the
 * database doesn't answer. Never cached; reads one row's worth of nothing.
 */
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  await connection();
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ status: "ok", db: "off" }, { headers });
  const { error } = await admin
    .from("feature_flags")
    .select("key", { count: "exact", head: true })
    .limit(1);
  return error
    ? NextResponse.json({ status: "down", db: "down" }, { status: 503, headers })
    : NextResponse.json({ status: "ok", db: "ok" }, { headers });
}
