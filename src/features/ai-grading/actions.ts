"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { getExercise } from "@/features/exercises/data";
import { variantOf } from "@/features/exercises/grade";
import { exerciseLimiter } from "@/features/exercises/limiter";
import { exerciseHtml, renderText } from "@/features/exercises/render-text";
import { getSession } from "@/lib/db/session";
import { allowWrite } from "@/lib/rate/write";

import { isOpen, rubricTexts } from "./service";

/**
 * Open answers without AI (Phase 10): after writing an answer, the learner compares it
 * with the reference solution and ticks the rubric items they covered. Also "report
 * unfair grading" for AI grades, stored as a grading dispute on the learner's own attempt.
 */
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

async function callerKey(): Promise<string> {
  const session = await getSession();
  if (session) return `user:${session.user.id}`;
  const h = await headers();
  return `ip:${h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local"}`;
}

export async function revealSelfCheck(
  input: unknown,
): Promise<
  | { ok: true; solutionHtml: string | null; rubricHtml: string[] }
  | { ok: false; reason: "invalid" | "rate-limited" | "not-found" }
> {
  const parsed = z
    .object({
      exerciseId: id,
      version: z.number().int().min(0).max(0xffff_ffff),
      locale: z.enum(["pl", "en"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!(await exerciseLimiter.hit(await callerKey()))) return { ok: false, reason: "rate-limited" };
  const ex = getExercise(parsed.data.exerciseId, isStyleguideEnabled(env));
  if (!ex || !isOpen(ex)) return { ok: false, reason: "not-found" };
  const lang = parsed.data.locale;
  const { params } = variantOf(ex, parsed.data.version);
  const solution = ex.solution
    ? lang === "en"
      ? (ex.solution.en ?? ex.solution.pl)
      : ex.solution.pl
    : null;
  return {
    ok: true,
    solutionHtml: solution === null ? null : exerciseHtml(solution, params, lang),
    rubricHtml: rubricTexts(ex, lang).map((r) => renderText(r)),
  };
}

export async function reportUnfairGrade(
  input: unknown,
): Promise<{ ok: true } | { ok: false; reason: "invalid" | "unauthorized" | "failed" }> {
  const parsed = z
    .object({ attemptId: z.number().int().positive(), note: z.string().trim().min(1).max(2000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const session = await getSession();
  if (!session) return { ok: false, reason: "unauthorized" };
  if (!(await allowWrite("reportUnfairGrade", session.user.id)))
    return { ok: false, reason: "failed" };
  // The user's own client: RLS only lets them dispute their own attempts.
  const { error } = await session.supabase.from("grading_disputes").insert({
    user_id: session.user.id,
    attempt_id: parsed.data.attemptId,
    reason: parsed.data.note,
  });
  return error ? { ok: false, reason: "failed" } : { ok: true };
}
