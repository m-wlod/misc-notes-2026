import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { resolveSiteUrl } from "@/config/runtime";
import { env } from "@/env";
import { recordRun } from "@/features/admin/cron-runs";
import { listEntries } from "@/features/debunk/entries";
import { listExercises } from "@/features/exercises/data";
import { publicView } from "@/features/exercises/view";
import { leagueWeek } from "@/features/gamification/days";
import { pickOfWeek, unsubscribeQuery, weeklyEmail } from "@/features/newsletter/core";
import { resendMailer } from "@/features/notify/email";
import { plainText } from "@/features/seo/jsonld";
import { withUtm } from "@/features/utm/utm";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { createAdminClient } from "@/lib/db/admin";

/**
 * The weekly newsletter (Phase 19c): "Problem tygodnia" (a weekly rotation through the
 * published exercises) and a Debunk Lab entry (likewise), to every confirmed subscriber.
 * Logged once per subscriber and week in `newsletter_sends`, so a retry never sends
 * twice. Dormant: 503 without CRON_SECRET or a database; nothing is sent without Resend
 * and the token secret.
 */
const BATCH = 500;

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
  return recordRun(admin, "newsletter", async () => {
    const json = (body: unknown) =>
      NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
    const tokenSecret = env.EMAIL_TOKEN_SECRET;
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !tokenSecret) {
      return json({ sent: 0, reason: "mailer-off" });
    }
    const mailer = resendMailer(env.RESEND_API_KEY, env.EMAIL_FROM);
    const week = leagueWeek(new Date());
    const site = resolveSiteUrl(env);
    const utm = { source: "newsletter", medium: "email", campaign: `week-${week}` };
    const url = (path: string) => new URL(withUtm(path, utm), site).toString();

    const exercise = pickOfWeek(listExercises(false), week);
    const issue = async (locale: Locale) => {
      const entry = pickOfWeek(listEntries(locale, false), week);
      return {
        t: await getTranslations({ locale, namespace: "newsletter" }),
        problem: exercise
          ? {
              text: plainText(publicView(exercise, 0, locale).promptHtml),
              url: url(
                getPathname({
                  href: { pathname: "/practice/[exercise]", params: { exercise: exercise.id } },
                  locale,
                }),
              ),
            }
          : null,
        debunk: entry
          ? {
              claim: entry.claim,
              url: url(
                getPathname({
                  href: { pathname: "/debunk/[slug]", params: { slug: entry.slug } },
                  locale,
                }),
              ),
            }
          : null,
        home: url(getPathname({ href: "/", locale })),
      };
    };
    const issues = { pl: await issue("pl"), en: await issue("en") };
    if (!issues.pl.problem && !issues.pl.debunk)
      return json({ sent: 0, reason: "nothing-to-send" });

    const { data: subscribers, error } = await admin
      .from("newsletter_subscribers")
      .select("id, email, locale")
      .not("confirmed_at", "is", null)
      .is("unsubscribed_at", null)
      .order("id")
      .limit(BATCH);
    if (error) return NextResponse.json({ error: "read failed" }, { status: 500 });

    let sent = 0;
    let skipped = 0;
    for (const sub of subscribers) {
      // Claim this week's send first: a second run (or a retry) finds it taken.
      const claim = await admin.from("newsletter_sends").insert({ week, subscriber_id: sub.id });
      if (claim.error) {
        skipped++;
        continue;
      }
      const locale: Locale = sub.locale === "en" ? "en" : "pl";
      const { t, problem, debunk, home } = issues[locale];
      const q = unsubscribeQuery(tokenSecret, sub.id);
      const ok = await mailer
        .send(
          weeklyEmail({
            to: sub.email,
            words: {
              subject: t("weekly.subject"),
              intro: t("weekly.intro"),
              problem: t("weekly.problem"),
              debunk: t("weekly.debunk"),
              cta: t("weekly.cta"),
              footer: t("weekly.footer"),
              unsubscribe: t("weekly.unsubscribe"),
            },
            problem,
            debunk,
            homeUrl: home,
            unsubscribe: {
              page: new URL(
                `${getPathname({ href: "/newsletter/unsubscribe", locale })}?${q}`,
                site,
              ).toString(),
              post: new URL(`/api/newsletter/unsubscribe?${q}`, site).toString(),
            },
          }),
        )
        .catch(() => false);
      if (ok) sent++;
      else {
        // Not sent: release the claim so the next run tries again.
        await admin.from("newsletter_sends").delete().eq("week", week).eq("subscriber_id", sub.id);
      }
    }
    return json({ week, sent, skipped, more: subscribers.length === BATCH });
  });
}
