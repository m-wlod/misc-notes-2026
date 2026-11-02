import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/display";
import { signOut } from "@/features/auth/actions";
import { CertificatesPanel } from "@/features/certificates/certificates-panel";
import { readCertificates, readTrackProgress } from "@/features/certificates/server";
import { readAchievements, readRatings } from "@/features/gamification/server/read";
import { AchievementsGrid } from "@/features/gamification/ui/achievements-grid";
import { SkillRadar } from "@/features/gamification/ui/skill-radar";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { isSupabaseConfigured } from "@/lib/db/config";
import { getSession } from "@/lib/db/session";

import { curriculum } from "../../../../content/curriculum";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/profile">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "account.profile" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProfilePage({ params }: PageProps<"/[locale]/profile">) {
  const t = await getTranslations("account.profile");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-8 text-3xl">{t("metaTitle")}</h1>
      <Suspense fallback={<Skeleton className="h-48 max-w-xl" />}>
        <ProfileBody params={params} />
      </Suspense>
    </div>
  );
}

async function ProfileBody({ params }: { params: PageProps<"/[locale]/profile">["params"] }) {
  const locale = (await params).locale as Locale;
  const t = await getTranslations("account.profile");
  const tAuth = await getTranslations("auth");
  const tOn = await getTranslations("onboarding");
  const format = await getFormatter();

  const session = isSupabaseConfigured() ? await getSession() : null;
  if (!session) {
    return (
      <div className="grid max-w-(--measure) gap-6">
        <p className="font-serif text-reading">
          {isSupabaseConfigured() ? t("signedOutBody") : tAuth("notConfigured")}
        </p>
        {isSupabaseConfigured() ? (
          <Link href="/sign-in" className={`${buttonClass("primary")} justify-self-start`}>
            {tAuth("signIn")}
          </Link>
        ) : null}
      </div>
    );
  }

  const { data: profile } = await session.supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (!profile) return null;
  if (!profile.onboarded_at) redirect({ href: "/onboarding", locale });
  const tG = await getTranslations("gamification");
  const tC = await getTranslations("certificates");
  const [ratings, owned, progress, certs] = await Promise.all([
    readRatings(session),
    readAchievements(session),
    readTrackProgress(session),
    readCertificates(session),
  ]);

  const level = (n: number | null) =>
    n ? `${String(n)} · ${tOn(`levels.${String(n) as "1"}.name`)}` : t("notSet");

  return (
    <div className="grid max-w-4xl gap-8">
      <dl className="grid gap-x-8 gap-y-4 border-y border-rule py-6 sm:grid-cols-[12rem_1fr]">
        <Row label={t("handle")}>
          <span className="num">{profile.handle}</span>
          {profile.display_name ? (
            <span className="ml-2 text-ink-muted">({profile.display_name})</span>
          ) : null}
        </Row>
        <Row label={t("goal")}>
          {profile.goal ? tOn(`goal.${profile.goal as "trading"}`) : t("notSet")}
        </Row>
        <Row label={t("selfLevel")}>{level(profile.self_level)}</Row>
        <Row label={t("placementLevel")}>
          {profile.placement_level ? (
            level(profile.placement_level)
          ) : (
            <Link href="/placement" className="text-accent-text underline underline-offset-4">
              {t("takePlacement")}
            </Link>
          )}
        </Row>
        <Row label={t("dailyGoal")}>
          {tOn("daily.minutes", { minutes: profile.daily_goal_minutes })}
        </Row>
        <Row label={t("visibility")}>{profile.is_public ? t("public") : t("private")}</Row>
        <Row label={t("joined")}>{format.dateTime(new Date(profile.created_at), "short")}</Row>
      </dl>
      <div className="flex flex-wrap gap-3">
        <Link href="/settings" className={buttonClass("secondary")}>
          {t("settings")}
        </Link>
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className={buttonClass("ghost")}>
            {tAuth("signOut")}
          </button>
        </form>
      </div>
      <section aria-labelledby="skills-title" className="grid gap-3">
        <h2 id="skills-title" className="text-xl">
          {tG("profile.skills")}
        </h2>
        <SkillRadar ratings={[...ratings].map(([topic, rating]) => ({ topic, rating }))} />
      </section>
      <section aria-labelledby="certificates-title" className="grid gap-3">
        <h2 id="certificates-title" className="text-xl">
          {tC("title")}
        </h2>
        <CertificatesPanel
          tracks={curriculum.map((tr) => ({
            id: tr.id,
            name: tr.name[locale === "en" ? "en" : "pl"],
            progress: progress.get(tr.id) ?? { lessonsTotal: 0, lessonsDone: 0, mastery: null },
            certificateId: certs.find((c) => c.track_id === tr.id)?.id ?? null,
          }))}
        />
      </section>
      <section aria-labelledby="achievements-title" className="grid gap-3">
        <h2 id="achievements-title" className="text-xl">
          {tG("profile.achievements")}
        </h2>
        <AchievementsGrid owned={owned} />
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-base">{children}</dd>
    </>
  );
}
