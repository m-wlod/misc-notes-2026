import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Badge, Skeleton } from "@/components/ui/display";
import { readPublicProfile } from "@/features/community/server/profile";
import { ReportProfile } from "@/features/community/ui/report-profile";
import { AchievementsGrid } from "@/features/gamification/ui/achievements-grid";
import { SkillRadar } from "@/features/gamification/ui/skill-radar";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/db/session";

import { curriculum } from "../../../../../content/curriculum";

type Props = PageProps<"/[locale]/u/[handle]">;

/** Shell prerenders with a placeholder; the profile itself is read per request. */
export function generateStaticParams() {
  return [{ handle: "example" }];
}

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * A public profile (Phase 17b), only for accounts that opted in under Settings.
 * Private or unknown handles are a 404 either way, so the page doesn't reveal which
 * handles exist.
 */
export default function PublicProfilePage({ params }: Props) {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-12 pb-16 sm:px-6">
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Profile params={params} />
      </Suspense>
    </div>
  );
}

async function Profile({ params }: Pick<Props, "params">) {
  await connection();
  const { handle, locale } = await params;
  const p = await readPublicProfile(handle);
  if (!p) notFound();
  const t = await getTranslations("community");
  const format = await getFormatter();
  const session = await getSession();
  const trackName = (id: string) =>
    curriculum.find((tr) => tr.id === id)?.name[locale === "en" ? "en" : "pl"] ?? id;
  const days = (n: number) => t("profile.days", { count: n });

  return (
    <div className="grid gap-10" data-public-profile={p.handle}>
      <header className="grid gap-2">
        <h1 className="text-3xl">{t("profile.title", { name: p.name ?? `@${p.handle}` })}</h1>
        <p className="font-sans text-sm text-ink-muted">
          @{p.handle} ·{" "}
          {t("profile.joined", {
            date: format.dateTime(new Date(p.joined), { dateStyle: "medium" }),
          })}
        </p>
        <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-2 font-sans text-sm">
          {p.level !== null ? (
            <div>
              <dt className="text-ink-muted">{t("profile.level")}</dt>
              <dd className="text-lg tabular-nums">{p.level}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-ink-muted">{t("profile.streak")}</dt>
            <dd className="text-lg tabular-nums">
              {days(p.streak.current)}{" "}
              <span className="text-sm text-ink-muted">
                ({t("profile.longest", { days: days(p.streak.longest) })})
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t("profile.reputation")}</dt>
            <dd className="text-lg tabular-nums">{p.reputation}</dd>
          </div>
          {p.badges.length > 0 ? (
            <div>
              <dt className="text-ink-muted">{t("profile.badges")}</dt>
              <dd className="flex flex-wrap gap-1 pt-1">
                {p.badges.map((b) => (
                  <Badge key={b}>{t(`badges.${b as "pomocny"}`)}</Badge>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      </header>

      {p.ratings.length > 0 ? <SkillRadar ratings={p.ratings} /> : null}

      <section aria-labelledby="certs-h" className="grid gap-3">
        <h2 id="certs-h" className="text-xl">
          {t("profile.certificates")}
        </h2>
        {p.certificates.length === 0 ? (
          <p className="text-ink-muted">{t("profile.none")}</p>
        ) : (
          <ul className="grid gap-1 font-sans text-sm">
            {p.certificates.map((c) => (
              <li key={c.id}>
                <Link href={{ pathname: "/verify/[id]", params: { id: c.id } }}>
                  {trackName(c.trackId)}
                </Link>{" "}
                <span className="text-ink-muted">
                  ({format.dateTime(new Date(c.issuedAt), { dateStyle: "medium" })})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sols-h" className="grid gap-3">
        <h2 id="sols-h" className="text-xl">
          {t("profile.solutions")}
        </h2>
        {p.solutions.length === 0 ? (
          <p className="text-ink-muted">{t("profile.none")}</p>
        ) : (
          <>
            <p className="font-sans text-xs text-ink-muted">{t("profile.solutionsNote")}</p>
            <ul className="grid gap-1 font-sans text-sm">
              {p.solutions.map((s) => (
                <li key={s.exerciseId}>
                  {s.published ? (
                    <Link
                      href={{
                        pathname: "/practice/[exercise]",
                        params: { exercise: s.exerciseId },
                      }}
                    >
                      {s.exerciseId}
                    </Link>
                  ) : (
                    s.exerciseId
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="ach-h" className="grid gap-3">
        <h2 id="ach-h" className="text-xl">
          {t("profile.achievements")}
        </h2>
        <AchievementsGrid owned={p.achievements} />
      </section>

      {session && session.user.id !== p.id ? <ReportProfile userId={p.id} /> : null}
    </div>
  );
}
