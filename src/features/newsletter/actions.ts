"use server";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { resolveSiteUrl } from "@/config/runtime";
import { env } from "@/env";
import { kvLimiter, memoryLimiter } from "@/features/exercises/rate-limit";
import { resendMailer } from "@/features/notify/email";
import { getPathname } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { sharedKV } from "@/lib/kv/shared";

import { confirmEmail, isConfirmToken } from "./core";
import { applyNewsletterUnsubscribe } from "./server";

/**
 * Newsletter sign-up with double opt-in (Phase 19c). The answer never says whether an
 * address is already on the list: everyone sees "check your inbox". Nothing is sent until
 * the address is confirmed from the email. Without a database the form says sign-ups
 * aren't open yet; without Resend the confirmation email isn't sent (dev, previews).
 */
const OPTIONS = { limit: 5, windowMs: 10 * 60_000 };
const limiter = env.UPSTASH_REDIS_REST_URL
  ? kvLimiter(sharedKV(), { ...OPTIONS, prefix: "rl:newsletter" })
  : memoryLimiter(OPTIONS);

export type SubscribeResult = { status: "sent" | "invalid" | "rate-limited" | "unavailable" };

const input = z.object({
  email: z.email().max(254),
  locale: z.enum(["pl", "en"]),
  /** Honeypot: people never see or fill it. */
  website: z.string().max(200),
});

export async function subscribe(raw: unknown): Promise<SubscribeResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { status: "invalid" };
  const { email, locale, website } = parsed.data;
  if (website) return { status: "sent" };
  const admin = createAdminClient();
  if (!admin) return { status: "unavailable" };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  if (!(await limiter.hit(`ip:${ip}`))) return { status: "rate-limited" };

  const address = email.trim().toLowerCase();
  const { data: existing } = await admin
    .from("newsletter_subscribers")
    .select("id, confirmed_at, unsubscribed_at")
    .eq("email", address)
    .maybeSingle();
  // Already subscribed: nothing to do, and nothing to reveal.
  if (existing?.confirmed_at && !existing.unsubscribed_at) return { status: "sent" };
  const token = randomUUID();
  const { error } = existing
    ? await admin
        .from("newsletter_subscribers")
        .update({ locale, confirm_token: token, confirmed_at: null, unsubscribed_at: null })
        .eq("id", existing.id)
    : await admin
        .from("newsletter_subscribers")
        .insert({ email: address, locale, confirm_token: token });
  if (error) return { status: "unavailable" };

  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    const t = await getTranslations({ locale, namespace: "newsletter" });
    const page = getPathname({ href: "/newsletter/confirm", locale });
    const url = new URL(`${page}?t=${token}`, resolveSiteUrl(env)).toString();
    await resendMailer(env.RESEND_API_KEY, env.EMAIL_FROM)
      .send(
        confirmEmail(
          address,
          {
            subject: t("confirmEmail.subject"),
            lines: [t("confirmEmail.line1"), t("confirmEmail.line2")],
            cta: t("confirmEmail.cta"),
            footer: t("confirmEmail.footer"),
          },
          url,
        ),
      )
      .catch(() => false);
  }
  return { status: "sent" };
}

/** The button on the confirmation page (a click, so link scanners can't confirm). */
export async function confirmSubscription(raw: unknown): Promise<{ ok: boolean }> {
  const parsed = z.object({ token: z.string() }).safeParse(raw);
  if (!parsed.success || !isConfirmToken(parsed.data.token)) return { ok: false };
  const admin = createAdminClient();
  if (!admin) return { ok: false };
  const { data } = await admin
    .from("newsletter_subscribers")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("confirm_token", parsed.data.token)
    .is("unsubscribed_at", null)
    .select("id");
  return { ok: (data ?? []).length > 0 };
}

/** The button on the unsubscribe page; the link in every issue carries a signed id. */
export async function unsubscribeNewsletter(raw: unknown): Promise<{ ok: boolean }> {
  const parsed = z.object({ i: z.string().max(20), s: z.string().max(100) }).safeParse(raw);
  if (!parsed.success) return { ok: false };
  return applyNewsletterUnsubscribe(parsed.data.i, parsed.data.s);
}
