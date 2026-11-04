import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";
import { recordRun } from "@/features/admin/cron-runs";
import { createAdminClient } from "@/lib/db/admin";

/**
 * Daily data retention (Phase 21b): `apply_retention()` redacts or deletes what the
 * privacy policy says we keep only for a while (see the migration for the table), then
 * `flag_xp_anomalies()` queues unusual XP for review (Phase 21c). Same
 * pattern as the other crons: dormant (503) without a database and CRON_SECRET.
 */
function authorised(request: NextRequest, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  const secret = env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!authorised(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });
  return recordRun(admin, "retention", async () => {
    const { data, error } = await admin.rpc("apply_retention");
    if (error) return NextResponse.json({ error: "retention failed" }, { status: 500 });
    // XP anomaly checks (Phase 21c): flags for a person to review, nothing is taken away.
    const flags = await admin.rpc("flag_xp_anomalies");
    if (flags.error) return NextResponse.json({ error: "xp check failed" }, { status: 500 });
    // Operational alert log (Phase 22a): 90 days.
    const alerts = await admin.rpc("prune_alert_log");
    return NextResponse.json({
      ok: true,
      removed: data,
      alertLog: alerts.data ?? null,
      xpFlags: flags.data,
    });
  });
}
