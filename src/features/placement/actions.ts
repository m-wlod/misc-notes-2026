"use server";

import { z } from "zod";

import { getSession } from "@/lib/db/session";
import { formText } from "@/lib/form";

import { gradePlacement, type QuestionResult } from "./grade";
import { PLACEMENT_IDS, PLACEMENT_QUESTIONS } from "./questions";

export type PlacementOutcome =
  | { status: "idle" }
  | { status: "graded"; results: QuestionResult[]; suggested: number; saved: boolean }
  | { status: "error" };

const answersSchema = z.record(z.enum(PLACEMENT_IDS as [string, ...string[]]), z.string().max(60));

/**
 * Grades the placement quiz on the server (answers never reach the browser) and stores
 * the suggested level for signed-in users. Only right/wrong per question is returned.
 */
export async function submitPlacement(
  _prev: PlacementOutcome,
  form: FormData,
): Promise<PlacementOutcome> {
  const raw = Object.fromEntries(PLACEMENT_IDS.map((id) => [id, formText(form, id)]));
  const parsed = answersSchema.safeParse(raw);
  if (!parsed.success) return { status: "error" };

  const { results, suggested } = gradePlacement(PLACEMENT_QUESTIONS, parsed.data);

  let saved = false;
  const session = await getSession();
  if (session) {
    const { error } = await session.supabase
      .from("profiles")
      .update({ placement_level: suggested })
      .eq("id", session.user.id);
    saved = !error;
  }
  return { status: "graded", results, suggested, saved };
}
