import "server-only";

import { env } from "@/env";
import { createAdminClient } from "@/lib/db/admin";

import { verifySubscriber } from "./core";

/** Leaving the newsletter by a signed link (page button or RFC 8058 one-click POST). */
export async function applyNewsletterUnsubscribe(
  i: string | null,
  s: string | null,
): Promise<{ ok: boolean }> {
  const id = verifySubscriber(env.EMAIL_TOKEN_SECRET, i ?? "", s ?? "");
  const admin = createAdminClient();
  if (id === null || !admin) return { ok: false };
  const { error } = await admin
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", id);
  return { ok: !error };
}
