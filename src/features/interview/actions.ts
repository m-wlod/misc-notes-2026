"use server";

import { z } from "zod";

import type { Rewards } from "@/features/gamification/server/award";
import { onInterviewSaved } from "@/features/gamification/server/hooks";
import { createAdminClient } from "@/lib/db/admin";
import type { Json } from "@/lib/db/database.types";
import { getSession } from "@/lib/db/session";

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
      durationMs: z.number().min(0),
    })
    .loose(),
  answers: z
    .array(
      z.object({
        questionId: z.string().max(120),
        given: z.string().max(2000),
        score: z.number().min(0).max(1),
        ms: z.number().min(0),
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
