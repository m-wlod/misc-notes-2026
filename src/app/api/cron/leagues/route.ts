import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";
import { rollFinishedWeeks } from "@/features/gamification/server/roll";
import { supabaseStore } from "@/features/gamification/server/supabase-store";
import { createAdminClient } from "@/lib/db/admin";

/**
 * The weekly league roll (Phase 14). Vercel Cron calls it daily; it closes every finished
 * week that isn't closed yet, so a missed day catches up and a repeat does nothing.
 * Dormant: 503 until a database and CRON_SECRET exist.
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
  try {
    const rolled = await rollFinishedWeeks(supabaseStore(admin));
    return NextResponse.json({ rolled }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "roll failed" }, { status: 500 });
  }
}
