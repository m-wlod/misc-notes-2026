import "server-only";

import { lessons } from "#content";
import { createAdminClient } from "@/lib/db/admin";
import type { Session } from "@/lib/db/session";

import { mistakeCardId } from "./cards";
import { newCard, type CardRow } from "./schedule";

/**
 * Review cards on the account (Phase 15). Review has no XP value, so the rows are the
 * user's own (RLS); the hooks below run inside server actions for the signed-in user.
 * Failures never break the action that called them.
 */
const lessonCardIds = (lessonId: string) =>
  lessons.find((l) => l.id === lessonId && l.locale === "pl")?.reviewCards.map((c) => c.id) ?? [];

/** A completed lesson adds its definitions and key formulas (once each). */
export async function addLessonCards(session: Session, lessonId: string, now = new Date()) {
  const ids = lessonCardIds(lessonId);
  if (ids.length === 0) return;
  try {
    await session.supabase.from("review_cards").upsert(
      ids.map((id) => ({ ...newCard(id, now), user_id: session.user.id })),
      { onConflict: "user_id,card_id", ignoreDuplicates: true },
    );
  } catch {
    // review is a bonus: the lesson still counts
  }
}

/**
 * A wrong answer adds a mistake card, or brings an existing one back to today. Called
 * from grading, which has the user id but not a user client, so it writes with the secret
 * key, scoped to that id.
 */
export async function addMistakeCard(userId: string, exerciseId: string, now = new Date()) {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const id = mistakeCardId(exerciseId);
    const { data } = await admin
      .from("review_cards")
      .select("due")
      .eq("user_id", userId)
      .eq("card_id", id)
      .maybeSingle();
    if (!data) {
      await admin.from("review_cards").insert({ ...newCard(id, now), user_id: userId });
    } else if (Date.parse(data.due) > now.getTime()) {
      await admin
        .from("review_cards")
        .update({ due: now.toISOString() })
        .eq("user_id", userId)
        .eq("card_id", id);
    }
  } catch {
    // grading must not fail because of review
  }
}

export async function readCards(session: Session): Promise<CardRow[]> {
  const { data } = await session.supabase
    .from("review_cards")
    .select(
      "card_id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review",
    )
    .order("due")
    .limit(500);
  return data ?? [];
}
