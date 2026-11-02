"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import type { Rewards } from "@/features/gamification/server/award";
import { onExerciseGraded } from "@/features/gamification/server/hooks";
import { addMistakeCard } from "@/features/review/server";
import { createAdminClient } from "@/lib/db/admin";
import { getSession } from "@/lib/db/session";

import { getExercise } from "./data";
import { grade, variantOf, type Result } from "./grade";
import { exerciseLimiter } from "./limiter";
import { exerciseHtml } from "./render-text";

/**
 * Grading, hints and solutions: all on the server (CLAUDE.md), for signed-in and
 * signed-out learners alike, rate-limited per caller. Signed-out attempts are stored by
 * the browser (qla:progress:v1); signed-in ones also go to exercise_attempts.
 */

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const submission = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), value: z.string().max(500) }),
  z.object({ kind: z.literal("number"), value: z.number() }),
  z.object({ kind: z.literal("choice"), value: id }),
  z.object({ kind: z.literal("multi"), values: z.array(id).max(50) }),
  z.object({ kind: z.literal("order"), values: z.array(id).max(50) }),
  z.object({
    kind: z.literal("code"),
    passed: z.number().int().min(0).max(100),
    total: z.number().int().min(1).max(100),
    value: z.number().nullable(),
  }),
]);

type Failure = {
  ok: false;
  reason:
    | "rate-limited"
    | "not-found"
    | "invalid"
    | "unreadable"
    | "not-gradable"
    | "percent-not-allowed";
};

async function caller(): Promise<{ key: string; userId: string | null }> {
  const session = await getSession();
  if (session) return { key: `user:${session.user.id}`, userId: session.user.id };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  return { key: `ip:${ip}`, userId: null };
}

/** A version is a variant index or, for random exercises, a uint32 seed. */
const VERSION_MAX = 0xffff_ffff;

const internal = () => isStyleguideEnabled(env);

export async function submitAttempt(
  input: unknown,
): Promise<
  { ok: true; result: Result; score: number; feedback?: string; rewards: Rewards | null } | Failure
> {
  const parsed = z
    .object({
      exerciseId: id,
      variant: z.number().int().min(0).max(VERSION_MAX),
      submission,
      locale: z.enum(["pl", "en"]).default("pl"),
      hintsUsed: z.number().int().min(0).max(20),
      timeMs: z.number().int().min(0).max(86_400_000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const who = await caller();
  if (!(await exerciseLimiter.hit(who.key))) return { ok: false, reason: "rate-limited" };
  const ex = getExercise(parsed.data.exerciseId, internal());
  if (!ex) return { ok: false, reason: "not-found" };

  const graded = grade(ex, parsed.data.variant, parsed.data.submission);
  if (!graded.ok) {
    return { ok: false, reason: graded.reason === "wrong-kind" ? "invalid" : graded.reason };
  }

  let rewards: Rewards | null = null;
  if (who.userId) {
    // Dormant until accounts are enabled: attempts are server-written (no client insert policy).
    const admin = createAdminClient();
    // First try = no earlier attempt at this exercise (any variant): earns the bonus.
    const { count } = admin
      ? await admin
          .from("exercise_attempts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", who.userId)
          .eq("exercise_id", ex.id)
      : { count: null };
    await admin?.from("exercise_attempts").insert({
      user_id: who.userId,
      exercise_id: ex.id,
      variant_seed: parsed.data.variant,
      answer: parsed.data.submission,
      score: graded.score,
      grader: "auto",
      hints_used: parsed.data.hintsUsed,
      time_ms: parsed.data.timeMs,
      source: "app",
    });
    if (graded.score < 1) await addMistakeCard(who.userId, ex.id);
    rewards = await onExerciseGraded(who.userId, ex, {
      score: graded.score,
      hintsUsed: parsed.data.hintsUsed,
      firstTry: count === 0,
    });
  }
  const mistake =
    graded.mistake !== undefined && "mistakes" in ex ? ex.mistakes[graded.mistake] : undefined;
  if (!mistake) return { ok: true, result: graded.result, score: graded.score, rewards };
  // A known mistake: targeted feedback, rendered here like hints.
  const lang = parsed.data.locale;
  const text = lang === "en" ? (mistake.feedback.en ?? mistake.feedback.pl) : mistake.feedback.pl;
  return {
    ok: true,
    result: graded.result,
    score: graded.score,
    feedback: exerciseHtml(text, variantOf(ex, parsed.data.variant).params, lang),
    rewards,
  };
}

export async function getHint(input: unknown): Promise<{ ok: true; html: string } | Failure> {
  const parsed = z
    .object({
      exerciseId: id,
      variant: z.number().int().min(0).max(VERSION_MAX),
      index: z.number().int().min(0).max(20),
      locale: z.enum(["pl", "en"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!(await exerciseLimiter.hit((await caller()).key)))
    return { ok: false, reason: "rate-limited" };
  const ex = getExercise(parsed.data.exerciseId, internal());
  const hint = ex?.hints[parsed.data.index];
  if (!ex || !hint) return { ok: false, reason: "not-found" };
  // From the page: next-intl's request locale isn't available inside server actions.
  const lang = parsed.data.locale;
  const text = lang === "en" ? (hint.en ?? hint.pl) : hint.pl;
  return { ok: true, html: exerciseHtml(text, variantOf(ex, parsed.data.variant).params, lang) };
}

export async function revealSolution(
  input: unknown,
): Promise<{ ok: true; html: string } | Failure> {
  const parsed = z
    .object({
      exerciseId: id,
      variant: z.number().int().min(0).max(VERSION_MAX),
      locale: z.enum(["pl", "en"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!(await exerciseLimiter.hit((await caller()).key)))
    return { ok: false, reason: "rate-limited" };
  const ex = getExercise(parsed.data.exerciseId, internal());
  if (!ex?.solution) return { ok: false, reason: "not-found" };
  // From the page: next-intl's request locale isn't available inside server actions.
  const lang = parsed.data.locale;
  const text = lang === "en" ? (ex.solution.en ?? ex.solution.pl) : ex.solution.pl;
  return { ok: true, html: exerciseHtml(text, variantOf(ex, parsed.data.variant).params, lang) };
}

/**
 * The hidden tests of a code exercise (Phase 13), sent only when the learner checks
 * their code: they run in the browser, so they can be read once sent. The grade still
 * needs the server's own check of the computed number (see gradeCode).
 */
export async function getCodeTests(input: unknown): Promise<
  | {
      ok: true;
      tests: { code: string; message: string }[];
      answerExpr: string | null;
    }
  | Failure
> {
  const parsed = z.object({ exerciseId: id, locale: z.enum(["pl", "en"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!(await exerciseLimiter.hit((await caller()).key)))
    return { ok: false, reason: "rate-limited" };
  const ex = getExercise(parsed.data.exerciseId, internal());
  if (ex?.type !== "code") return { ok: false, reason: "not-found" };
  const lang = parsed.data.locale;
  return {
    ok: true,
    tests: ex.tests.map((t) => ({
      code: t.code,
      message: lang === "en" ? (t.message.en ?? t.message.pl) : t.message.pl,
    })),
    answerExpr: ex.answerExpr ?? null,
  };
}
