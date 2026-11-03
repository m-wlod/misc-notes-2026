import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { env } from "@/env";
import { kvLimiter, memoryLimiter } from "@/features/exercises/rate-limit";
import { landingPath, parseUtm } from "@/features/utm/utm";
import { createAdminClient } from "@/lib/db/admin";
import { sharedKV } from "@/lib/kv/shared";

/**
 * POST /api/utm (Phase 19): one landing from a campaign link, sent once per tab by the
 * beacon. Counted as +1 on today's row for that campaign and page; the visitor's IP is
 * used only for the rate limit and never stored. Without a database it does nothing.
 */
const OPTIONS = { limit: 20, windowMs: 60_000 };
const limiter = env.UPSTASH_REDIS_REST_URL
  ? kvLimiter(sharedKV(), { ...OPTIONS, prefix: "rl:utm" })
  : memoryLimiter(OPTIONS);

const body = z.object({ search: z.string().max(1000), path: z.string().max(300) });

export async function POST(request: NextRequest) {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = body.safeParse(raw);
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const utm = parseUtm(parsed.data.search);
  const path = landingPath(parsed.data.path);
  if (!utm || !path) return new NextResponse(null, { status: 204 });
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  if (!(await limiter.hit(`ip:${ip}`))) return new NextResponse(null, { status: 429 });
  const admin = createAdminClient();
  if (admin) {
    await admin.rpc("record_utm_visit", {
      src: utm.source,
      med: utm.medium,
      camp: utm.campaign,
      path,
    });
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
