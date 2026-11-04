"use server";

import { z } from "zod";

import { getSession } from "@/lib/db/session";
import { allowWrite } from "@/lib/rate/write";

/**
 * Notification preferences and push subscriptions (Phase 15), written as the signed-in
 * user (RLS: own rows only).
 */
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

export async function saveNotificationPrefs(input: unknown): Promise<{ ok: boolean }> {
  const parsed = z
    .object({
      streak: z.boolean(),
      weekly: z.boolean(),
      league: z.boolean(),
      quietStart: time,
      quietEnd: time,
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const session = await getSession();
  if (!session) return { ok: false };
  if (!(await allowWrite("settings", session.user.id))) return { ok: false };
  const p = parsed.data;
  // Both ends or neither: a half-set window would mean nothing.
  const quiet = p.quietStart && p.quietEnd ? [p.quietStart, p.quietEnd] : [null, null];
  const { error } = await session.supabase.from("notification_prefs").upsert(
    {
      user_id: session.user.id,
      email_streak: p.streak,
      email_weekly: p.weekly,
      email_league: p.league,
      quiet_start: quiet[0] ?? null,
      quiet_end: quiet[1] ?? null,
    },
    { onConflict: "user_id" },
  );
  return { ok: !error };
}

const subscription = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  p256dh: z.string().min(10).max(200),
  auth: z.string().min(10).max(100),
});

export async function setPush(input: unknown): Promise<{ ok: boolean }> {
  const parsed = z.object({ on: z.boolean(), sub: subscription.nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const session = await getSession();
  if (!session) return { ok: false };
  if (!(await allowWrite("settings", session.user.id))) return { ok: false };
  const db = session.supabase;
  if (parsed.data.on && parsed.data.sub) {
    const { error } = await db.from("push_subscriptions").upsert(
      { ...parsed.data.sub, user_id: session.user.id },
      // No update policy (RLS): an existing subscription is simply kept.
      { onConflict: "endpoint", ignoreDuplicates: true },
    );
    if (error) return { ok: false };
  } else if (parsed.data.sub) {
    await db.from("push_subscriptions").delete().eq("endpoint", parsed.data.sub.endpoint);
  }
  const { error } = await db
    .from("notification_prefs")
    .upsert({ user_id: session.user.id, push_enabled: parsed.data.on }, { onConflict: "user_id" });
  return { ok: !error };
}
