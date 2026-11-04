"use server";

import { z } from "zod";

import type { Rewards } from "@/features/gamification/server/award";
import { onInterviewSaved } from "@/features/gamification/server/hooks";
import { createAdminClient } from "@/lib/db/admin";
import type { Json } from "@/lib/db/database.types";
import { getSession } from "@/lib/db/session";
import { allowWrite } from "@/lib/rate/write";

import { SESSION_KINDS } from "./session";

/**
 * Stores a finished interview scorecard on the account (Phase 11). Dormant until
 * accounts exist: signed out (today, everyone) it does nothing and the browser copy
 * is the record. The tables are server-written, so the secret-key client inserts,
 * always for the signed-in user only.
 */
const input = z.object({
  entry: z
    .object({
      id: z.string().max(80),
      kind: z.enum(SESSION_KINDS),
      level: z.number().int().min(1).max(5),
      score: z.number().min(0).max(1),
      finishedAt: z.iso.datetime(),
      // Sessions last minutes; two hours bounds the stored start time (Phase 21).
      durationMs: z
        .number()
        .min(0)
        .max(2 * 3_600_000),
      // The scorecard fields `entryFrom` writes (store.ts); nothing else is stored.
      correct: z.number().int().min(0).max(1000),
      answered: z.number().int().min(0).max(1000),
      total: z.number().int().min(0).max(1000),
      avgMs: z.number().min(0).max(3_600_000).nullable(),
      review: z.array(z.string().max(60)).max(20),
      pnl: z.number().min(-1e9).max(1e9).optional(),
    })
    .strict(),
  answers: z
    .array(
      z.object({
        questionId: z.string().max(120),
        given: z.string().max(2000),
        score: z.number().min(0).max(1),
        ms: z.number().min(0).max(3_600_000),
        topic: z.string().max(60),
      }),
    )
    .max(200),
});

export async function saveInterviewSession(
  raw: unknown,
): Promise<{ ok: boolean; rewards?: Rewards | null }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const session = await getSession();
  const admin = createAdminClient();
  if (!session || !admin) return { ok: false };
  if (!(await allowWrite("saveInterviewSession", session.user.id))) return { ok: false };
  const { entry, answers } = parsed.data;
  const started = new Date(new Date(entry.finishedAt).getTime() - entry.durationMs).toISOString();
  const { data, error } = await admin
    .from("interview_sessions")
    .insert({
      user_id: session.user.id,
      kind: entry.kind,
      level: entry.level,
      started_at: started,
      finished_at: entry.finishedAt,
      score: entry.score,
      summary: JSON.parse(JSON.stringify(entry)) as Json,
    })
    .select("id")
    .single();
  if (error) return { ok: false };
  if (answers.length > 0) {
    await admin.from("interview_answers").insert(
      answers.map((a) => ({
        session_id: data.id,
        user_id: session.user.id,
        question_id: a.questionId,
        answer: { given: a.given, ms: a.ms, topic: a.topic },
        score: a.score,
      })),
    );
  }
  const rewards = await onInterviewSaved(session.user.id, {
    id: entry.id,
    kind: entry.kind,
    personalBest: (entry as { personalBest?: unknown }).personalBest === true,
    pnl:
      typeof (entry as { pnl?: unknown }).pnl === "number"
        ? ((entry as { pnl?: number }).pnl ?? null)
        : null,
  });
  return { ok: true, rewards };
}
