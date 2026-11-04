import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { aiAvailable, isOpen } from "@/features/ai-grading/service";
import { getExercise } from "@/features/exercises/data";
import { followUpQuestion } from "@/features/interview/follow-up-service";
import { isBot } from "@/lib/bot/check";
import { getSession } from "@/lib/db/session";

/**
 * POST /api/interview/follow-up (Phase 11): one probing interviewer question about an
 * open answer. Signed-in users only; counts toward the AI quota. 503 without a key.
 */
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const input = z.object({
  exerciseId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: z.number().int().min(0).max(0xffff_ffff),
  locale: z.enum(["pl", "en"]),
  answer: z
    .string()
    .trim()
    .min(1)
    .max(12_000)
    .refine((s) => words(s) <= 1500),
});

const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const session = await getSession();
  if (!session) return json({ error: "unauthorized" }, 401);
  // Bots never reach the paid model (Vercel BotID, Phase 21c).
  if (await isBot()) return json({ error: "forbidden" }, 403);
  if (!aiAvailable()) return json({ error: "not-configured" }, 503);
  const ex = getExercise(parsed.data.exerciseId, isStyleguideEnabled(env));
  if (!ex || !isOpen(ex)) return json({ error: "not-found" }, 404);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  const result = await followUpQuestion(ex, {
    version: parsed.data.version,
    answer: parsed.data.answer,
    lang: parsed.data.locale,
    userId: session.user.id,
    ip,
  });
  if (result.ok) return json(result, 200);
  return json(
    { error: result.reason },
    result.reason === "fallback" ? 502 : result.reason === "not-configured" ? 503 : 429,
  );
}
