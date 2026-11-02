"use server";

import { z } from "zod";

import { challenges } from "#content";
import { getSession } from "@/lib/db/session";

import { currentChallenge } from "./current";

/**
 * Sends a solution to this week's challenge (Phase 15), as the signed-in user (RLS: own
 * rows, status pending). Moderation and highlighting come with the community (Phase 17).
 */
export async function submitChallenge(input: unknown): Promise<{ ok: boolean }> {
  const parsed = z
    .object({ challengeId: z.string().max(120), body: z.string().trim().min(40).max(20_000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const c = currentChallenge(challenges, new Date());
  if (!c?.open || c.id !== parsed.data.challengeId) return { ok: false };
  const session = await getSession();
  if (!session) return { ok: false };
  const { error } = await session.supabase.from("challenge_submissions").insert({
    user_id: session.user.id,
    challenge_id: c.id,
    body: parsed.data.body,
  });
  return { ok: !error };
}
