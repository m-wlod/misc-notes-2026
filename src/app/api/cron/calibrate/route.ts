import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";
import { recordRun } from "@/features/admin/cron-runs";
import { allExercises } from "@/features/exercises/data";
import { calibrate, flags, type AttemptRow } from "@/features/grading/calibrate";
import { createAdminClient } from "@/lib/db/admin";

/**
 * Nightly difficulty calibration (Phase 9): exercise_attempts → exercise_stats, plus the
 * exercises whose success rate doesn't fit their level. Dormant: it answers 503 until a
 * database and CRON_SECRET exist; Vercel Cron schedules it in Phase 14.
 */
const PAGE = 1000;

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
  return recordRun(admin, "calibrate", async () => {
    const rows: AttemptRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("exercise_attempts")
        .select("exercise_id, score, time_ms")
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) return NextResponse.json({ error: "read failed" }, { status: 500 });
      rows.push(
        ...data.map((r) => ({ exerciseId: r.exercise_id, score: r.score, timeMs: r.time_ms })),
      );
      if (data.length < PAGE) break;
    }

    const stats = calibrate(rows);
    if (stats.length > 0) {
      const { error } = await admin.from("exercise_stats").upsert(
        stats.map((s) => ({
          exercise_id: s.exerciseId,
          attempts: s.attempts,
          success_rate: s.successRate,
          median_time_ms: s.medianTimeMs,
          updated_at: new Date().toISOString(),
        })),
      );
      if (error) return NextResponse.json({ error: "write failed" }, { status: 500 });
    }

    const levels = new Map(allExercises().map((e) => [e.id, e.level]));
    return NextResponse.json(
      { exercises: stats.length, flags: flags(stats, (id) => levels.get(id)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
