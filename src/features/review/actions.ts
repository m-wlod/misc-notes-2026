"use server";

import { z } from "zod";

import { getSession } from "@/lib/db/session";
import { allowWrite } from "@/lib/rate/write";

import { GRADES, rate } from "./schedule";

/**
 * Rates one review card (Phase 15): the server loads the user's row, schedules it with
 * FSRS and saves it (RLS: own rows only). The browser only sends the card and the answer.
 */
export async function reviewCard(input: unknown): Promise<{ ok: boolean; due?: string }> {
  const parsed = z
    .object({ cardId: z.string().min(1).max(160), grade: z.enum(GRADES) })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const session = await getSession();
  if (!session) return { ok: false };
  if (!(await allowWrite("reviewCard", session.user.id))) return { ok: false };
  const { data: row } = await session.supabase
    .from("review_cards")
    .select(
      "card_id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review",
    )
    .eq("card_id", parsed.data.cardId)
    .maybeSingle();
  if (!row) return { ok: false };
  const next = rate(row, parsed.data.grade, new Date());
  const { error } = await session.supabase
    .from("review_cards")
    .update(next)
    .eq("user_id", session.user.id)
    .eq("card_id", next.card_id);
  return error ? { ok: false } : { ok: true, due: next.due };
}
