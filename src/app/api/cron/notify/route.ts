import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { resolveSiteUrl } from "@/config/runtime";
import { env } from "@/env";
import { resendMailer } from "@/features/notify/email";
import { webPushSender } from "@/features/notify/push";
import { runNotifications } from "@/features/notify/run";
import { supabaseNotifyStore } from "@/features/notify/supabase-store";
import { unsubscribeQuery } from "@/features/notify/token";
import { emailWords } from "@/features/notify/words";
import { getPathname } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/db/admin";

/**
 * Daily notifications (Phase 15): streak reminders, and on Mondays the weekly summary
 * and league results. Dormant (503) without a database and CRON_SECRET; sends email
 * only with RESEND_API_KEY + EMAIL_FROM + EMAIL_TOKEN_SECRET (no email without a working
 * unsubscribe link), push only with both VAPID keys.
 */
function authorised(request: NextRequest, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  const secret = env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!authorised(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const site = resolveSiteUrl(env);
  const tokenSecret = env.EMAIL_TOKEN_SECRET;
  const mailer =
    env.RESEND_API_KEY && env.EMAIL_FROM && tokenSecret
      ? resendMailer(env.RESEND_API_KEY, env.EMAIL_FROM)
      : null;
  const push =
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
      ? webPushSender(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, site.toString())
      : null;
  try {
    const counts = await runNotifications({
      store: supabaseNotifyStore(admin),
      mailer,
      push,
      words: emailWords,
      now: new Date(),
      links: {
        cta: (kind, locale) =>
          new URL(
            getPathname({ href: kind === "league" ? "/league" : "/", locale }),
            site,
          ).toString(),
        unsubscribe: (userId, kind, locale) => {
          if (!tokenSecret) return null;
          const q = unsubscribeQuery(tokenSecret, userId, kind);
          return {
            page: new URL(`${getPathname({ href: "/unsubscribe", locale })}?${q}`, site).toString(),
            post: new URL(`/api/unsubscribe?${q}`, site).toString(),
          };
        },
      },
    });
    return NextResponse.json(counts, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "run failed" }, { status: 500 });
  }
}
