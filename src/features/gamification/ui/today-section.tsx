import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";

import { lessonHref, lessonsInOrder } from "@/features/curriculum";
import type { Exercise } from "@/features/exercises/schema";
import { plainTitle } from "@/features/exercises/title";
import { dueCount } from "@/features/review/schedule";
import { readCards } from "@/features/review/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { isSupabaseConfigured } from "@/lib/db/config";
import { getSession } from "@/lib/db/session";

import {
  problemOfTheDay,
  readLeague,
  readMe,
  readRatings,
  recommendedExercise,
} from "../server/read";
import { nextLesson } from "../today";
import { Dashboard, ProblemOfDay, type DashboardData } from "./dashboard";
import { SignedOutNextLesson } from "./signed-out-next";

/**
 * "Your day" on the home page (Phase 14): the dashboard for signed-in learners; for
 * everyone else the next lesson (from this browser's progress) and the problem of the
 * day. Request-time (the date and the session), so it sits inside <Suspense>.
 */

function exerciseLink(ex: Exercise, locale: Locale) {
  return {
    title: plainTitle(locale === "en" ? (ex.prompt.en ?? ex.prompt.pl) : ex.prompt.pl),
    level: ex.level,
    href: getPathname({
      href: { pathname: "/practice/[exercise]", params: { exercise: ex.id } },
      locale,
    }),
  };
}

export async function TodaySection() {
  await connection();
  const locale = await getLocale();
  const t = await getTranslations("gamification");
  const problem = problemOfTheDay();
  const problemLink = problem ? exerciseLink(problem, locale) : null;
  const order = lessonsInOrder(locale).map((p) => ({
    id: p.lesson.id,
    title: p.lesson.title,
    href: lessonHref(p.lesson),
  }));

  const session = isSupabaseConfigured() ? await getSession() : null;
  const me = session ? await readMe(session) : null;
  if (!session || !me) {
    return (
      <section aria-labelledby="today-title" className="mb-14">
        <h2 id="today-title" className="mb-4 text-xl">
          {t("dashboard.today")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SignedOutNextLesson lessons={order} />
          <ProblemOfDay problem={problemLink} />
        </div>
      </section>
    );
  }

  const [league, ratings, done, cards] = await Promise.all([
    me.leagueOptOut ? Promise.resolve(null) : readLeague(session),
    readRatings(session),
    session.supabase.from("lesson_progress").select("lesson_id, status"),
    readCards(session),
  ]);
  const status = new Map((done.data ?? []).map((r) => [r.lesson_id, r.status as string]));
  const next = nextLesson(order, (id) => status.get(id));
  const rec = recommendedExercise(ratings, me.solved);
  const mine = league?.members.find((m) => m.userId === league.me);
  const data: DashboardData = {
    todayXp: me.todayXp,
    goal: me.goal,
    streak: me.streak,
    league: me.leagueOptOut
      ? { kind: "off" }
      : league && mine
        ? {
            kind: "member",
            tierName: t(`tiers.${league.tierSlug}` as "tiers.bernoulli"),
            rank: mine.rank,
            size: league.members.length,
          }
        : { kind: "none" },
    nextLesson: next ? { title: next.title, href: next.href } : null,
    recommended: rec ? exerciseLink(rec as Exercise, locale) : null,
    problem: problemLink,
    reviewDue: dueCount(cards, new Date()),
  };
  return (
    <section aria-labelledby="today-title" className="mb-14">
      <h2 id="today-title" className="mb-4 text-xl">
        {t("dashboard.title")}
      </h2>
      <Dashboard data={data} />
    </section>
  );
}
