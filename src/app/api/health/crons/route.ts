import { connection, NextResponse } from "next/server";

import { cronHealth, healthy } from "@/features/alerts/rules";
import { createAdminClient } from "@/lib/db/admin";

/**
 * GET /api/health/crons (Phase 22a): did every scheduled job run recently and succeed?
 * For the uptime monitor: 200 when all are fine, 503 naming the late or failed ones.
 * Failed runs also alert at once (recordRun); this catches jobs that never started.
 * Without a database the jobs are off, which is fine: 200 `{ status: "off" }`.
 */
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  await connection();
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ status: "off" }, { headers });
  const since = new Date(Date.now() - 9 * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("cron_runs")
    .select("job, started_at, ok")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ status: "down" }, { status: 503, headers });
  const jobs = cronHealth(data, Date.now());
  return NextResponse.json(
    { status: healthy(jobs) ? "ok" : "unhealthy", jobs },
    { status: healthy(jobs) ? 200 : 503, headers },
  );
}
