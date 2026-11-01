"use server";

import { z } from "zod";

import { getSession } from "@/lib/db/session";

const onboardingSchema = z.object({
  goal: z.enum(["trading", "interviews", "university", "curiosity"]),
  self_level: z.number().int().min(1).max(5),
  daily_goal_minutes: z.union([z.literal(5), z.literal(10), z.literal(20)]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Saves the three onboarding answers and marks onboarding done (RLS: own profile only). */
export async function saveOnboarding(input: OnboardingInput): Promise<{ ok: boolean }> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const session = await getSession();
  if (!session) return { ok: false };
  const { error } = await session.supabase
    .from("profiles")
    .update({ ...parsed.data, onboarded_at: new Date().toISOString() })
    .eq("id", session.user.id);
  return { ok: !error };
}
