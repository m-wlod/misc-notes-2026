"use server";

import { z } from "zod";

import { getExercise } from "@/features/exercises/data";
import { encodeRef } from "@/features/gamification/facts";
import { award } from "@/features/gamification/server/award";
import { gamificationStore, lookups } from "@/features/gamification/server/index";
import { exerciseXp, xpKey } from "@/features/gamification/xp";

import { audit, staffFor } from "./server";

/**
 * AI-grading disputes (Phase 18b), for moderators and admins. Upholding one sets the
 * attempt's new score; if that turns it into a solve, the learner gets the exercise's
 * XP through the usual award path. The key is the exercise's own (`exercise:<id>`), so
 * someone who already earned XP for that exercise gets nothing twice: the award is the
 * difference. Both outcomes are audited.
 */
const input = z.discriminatedUnion("status", [
  z.object({
    id: z.number().int().positive(),
    status: z.literal("approved"),
    /** AI points, 0–4 (stored as a share of 4, like the AI grade). */
    points: z.number().int().min(0).max(4),
  }),
  z.object({ id: z.number().int().positive(), status: z.literal("rejected") }),
]);

export async function resolveDispute(raw: unknown): Promise<{ ok: boolean; xp?: number }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const who = await staffFor("disputes");
  if (!who) return { ok: false };
  const { id, status } = parsed.data;
  const { data: dispute } = await who.admin
    .from("grading_disputes")
    .select("status, user_id, attempt_id")
    .eq("id", id)
    .maybeSingle();
  // Pending only, and nobody settles their own dispute.
  if (dispute?.status !== "pending" || dispute.user_id === who.actor) return { ok: false };
  const { data: attempt } = await who.admin
    .from("exercise_attempts")
    .select("exercise_id, score, hints_used")
    .eq("id", dispute.attempt_id)
    .maybeSingle();
  if (!attempt) return { ok: false };

  const before = attempt.score;
  const after = parsed.data.status === "approved" ? parsed.data.points / 4 : before;
  if (after !== before) {
    const { error } = await who.admin
      .from("exercise_attempts")
      .update({ score: after })
      .eq("id", dispute.attempt_id);
    if (error) return { ok: false };
  }
  const { error } = await who.admin
    .from("grading_disputes")
    .update({ status, resolved_by: who.actor, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false };

  let xp = 0;
  const ex = getExercise(attempt.exercise_id, true);
  if (after >= 1 && before < 1 && ex) {
    const store = gamificationStore();
    const rewards = store
      ? await award(
          store,
          dispute.user_id,
          {
            reason: "exercise",
            amount: exerciseXp({
              level: ex.level,
              hintsUsed: attempt.hints_used,
              firstTry: false,
              correct: true,
            }),
            key: xpKey.exercise(ex.id),
            ref: encodeRef({ id: ex.id, l: ex.level, t: ex.type, h: attempt.hints_used, f: false }),
          },
          lookups,
        )
      : null;
    xp = rewards?.xp ?? 0;
  }
  const ok = await audit(who.admin, who.actor, `dispute.${status}`, `dispute:${String(id)}`, {
    attempt: dispute.attempt_id,
    exercise: attempt.exercise_id,
    before,
    after,
    xp,
  });
  return { ok, xp };
}
