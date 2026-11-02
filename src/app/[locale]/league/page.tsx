import type { Metadata } from "next";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { alternatesFor } from "@/components/shell/section-page";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/display";
import { addDays, leagueWeek } from "@/features/gamification/days";
import { readLeague, readMe } from "@/features/gamification/server/read";
import { LeagueTable } from "@/features/gamification/ui/league-table";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { isSupabaseConfigured } from "@/lib/db/config";
import { getSession } from "@/lib/db/session";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/league">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "gamification.league" });
  return {
    title: t("metaTitle"),
    description: t("lead"),
    alternates: alternatesFor("/league", locale),
    robots: { index: false },
  };
}

/** This week's league (Phase 14). Signed-in only; the table is the user's own group. */
export default async function LeaguePage() {
  const t = await getTranslations("gamification.league");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-3 text-3xl">{t("metaTitle")}</h1>
      <p className="mb-8 max-w-(--measure) text-base text-ink-muted">{t("lead")}</p>
      <Suspense fallback={<Skeleton className="h-64 max-w-xl" />}>
        <LeagueBody />
      </Suspense>
    </div>
  );
}

async function LeagueBody() {
  await connection();
  const t = await getTranslations("gamification");
  const tAuth = await getTranslations("auth");
  const format = await getFormatter();
  const note = (text: string) => (
    <p data-league-note="" className="max-w-(--measure) font-serif text-reading">
      {text}
    </p>
  );

  if (!isSupabaseConfigured()) return note(tAuth("notConfigured"));
  const session = await getSession();
  if (!session) {
    return (
      <div className="grid gap-4">
        {note(t("league.signedOut"))}
        <Link href="/sign-in" className={`${buttonClass("primary")} justify-self-start`}>
          {tAuth("signIn")}
        </Link>
      </div>
    );
  }
  const me = await readMe(session);
  if (me?.leagueOptOut) {
    return (
      <div className="grid gap-4">
        {note(t("league.optedOut"))}
        <Link href="/settings">{t("league.settings")}</Link>
      </div>
    );
  }
  const league = await readLeague(session);
  if (!league) return note(t("league.notJoined"));
  const sunday = addDays(leagueWeek(new Date()), 6);
  const tierName = t(`tiers.${league.tierSlug}` as "tiers.bernoulli");
  return (
    <div className="grid gap-4">
      <h2 className="text-xl">{t("league.tier", { tier: tierName })}</h2>
      <p className="font-sans text-sm text-ink-muted">
        {t("league.endsOn", {
          date: format.dateTime(new Date(`${sunday}T12:00:00Z`), {
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          }),
        })}
      </p>
      <LeagueTable data={{ tierName, mode: league.mode, me: league.me, members: league.members }} />
    </div>
  );
}
