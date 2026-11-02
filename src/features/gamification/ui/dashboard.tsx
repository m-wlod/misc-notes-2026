import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";

import type { StreakState } from "../streak";
import { GoalRing } from "./goal-ring";

/**
 * The signed-in home dashboard (Phase 14), presentational: the loader in app/[locale]
 * reads the data; /styleguide renders it with sample data.
 */
export type DashboardData = {
  todayXp: number;
  goal: number;
  streak: Pick<StreakState, "current" | "freezes" | "atRisk" | "repairable">;
  league:
    | { kind: "member"; tierName: string; rank: number; size: number }
    | { kind: "none" }
    | { kind: "off" };
  nextLesson: { title: string; href: Parameters<typeof Link>[0]["href"] } | null;
  recommended: { title: string; level: number; href: string } | null;
  problem: { title: string; level: number; href: string } | null;
  /** Review cards due today (Phase 15). */
  reviewDue: number;
};

function Card({ title, children, testId }: { title: string; children: ReactNode; testId: string }) {
  return (
    <section
      aria-label={title}
      data-dashboard={testId}
      className="grid content-start gap-2 rounded-md border border-rule-strong bg-surface px-5 py-4"
    >
      <h3 className="font-sans text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Dashboard({ data }: { data: DashboardData }) {
  const t = useTranslations("gamification.dashboard");
  const done = data.todayXp >= data.goal;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card title={t("goal")} testId="goal">
        <div className="flex items-center gap-4">
          <GoalRing
            xp={data.todayXp}
            goal={data.goal}
            label={`${t("goal")}: ${t("goalProgress", { xp: data.todayXp, goal: data.goal })}`}
          />
          <p className="font-sans text-sm text-ink">
            {done ? t("goalDone") : t("goalProgress", { xp: data.todayXp, goal: data.goal })}
          </p>
        </div>
      </Card>
      <Card title={t("streak")} testId="streak">
        <p className="font-mono text-2xl text-ink">
          {t("streakDays", { days: data.streak.current })}
        </p>
        {data.streak.repairable ? (
          <p className="font-sans text-sm text-ink">
            {t("repair", { lost: data.streak.repairable.lost, xp: data.goal * 2 })}
          </p>
        ) : data.streak.atRisk ? (
          <p className="font-sans text-sm text-ink">{t("atRisk")}</p>
        ) : null}
        <p className="font-sans text-xs text-ink-muted">
          {t("freezes", { n: data.streak.freezes })}
        </p>
      </Card>
      <Card title={t("league")} testId="league">
        <p className="font-sans text-sm text-ink">
          {data.league.kind === "member"
            ? t("leaguePlace", {
                tier: data.league.tierName,
                rank: data.league.rank,
                size: data.league.size,
              })
            : data.league.kind === "off"
              ? t("leagueOff")
              : t("leagueNone")}
        </p>
        <Link href="/league" className="font-sans text-sm">
          {t("league")} →
        </Link>
      </Card>
      <Card title={t("nextLesson")} testId="next-lesson">
        {data.nextLesson ? (
          <Link href={data.nextLesson.href} className="text-base">
            {data.nextLesson.title}
          </Link>
        ) : (
          <p className="font-sans text-sm text-ink-muted">{t("allLessons")}</p>
        )}
      </Card>
      <Card title={t("recommended")} testId="recommended">
        {data.recommended ? (
          <p className="text-base">
            <a href={data.recommended.href}>{data.recommended.title}</a>{" "}
            <span className="font-sans text-xs text-ink-muted">
              {t("level", { level: data.recommended.level })}
            </span>
          </p>
        ) : (
          <p className="font-sans text-sm text-ink-muted">{t("noRecommendation")}</p>
        )}
      </Card>
      <Card title={t("review")} testId="review">
        <p className="font-mono text-2xl text-ink">{data.reviewDue}</p>
        <Link href="/review" className="font-sans text-sm">
          {t("reviewStart")} →
        </Link>
      </Card>
      <ProblemOfDay problem={data.problem} />
    </div>
  );
}

export function ProblemOfDay({ problem }: { problem: DashboardData["problem"] }) {
  const t = useTranslations("gamification.dashboard");
  return (
    <Card title={t("problemOfDay")} testId="problem">
      {problem ? (
        <p className="text-base">
          <a href={problem.href}>{problem.title}</a>{" "}
          <span className="font-sans text-xs text-ink-muted">
            {t("level", { level: problem.level })}
          </span>
        </p>
      ) : (
        <p className="font-sans text-sm text-ink-muted">{t("problemEmpty")}</p>
      )}
    </Card>
  );
}
