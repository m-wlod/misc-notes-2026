import "server-only";

import { allExercises } from "@/features/exercises/data";
import type { Exercise } from "@/features/exercises/schema";
import { isVisible } from "@/features/exercises/visibility";
import { createAdminClient } from "@/lib/db/admin";
import type { Session } from "@/lib/db/session";

import { LEAGUE, TIERS } from "../config";
import { leagueWeek, localDate, type LocalDate } from "../days";
import { goalAndRepairDays, parseRef, type XpRow } from "../facts";
import { modeFor } from "../league";
import { recommend } from "../rating";
import { replayStreak, type StreakState } from "../streak";
import { pickOfDay } from "../today";
import { goalXp, type XpReason } from "../xp";

/**
 * What the signed-in pages show (Phase 14), read as the user (RLS: own rows, and the
 * members of one's own league group). Everything is recomputed from the XP log, so
 * these views can't drift from what was awarded.
 */
const PAGE = 1000;

async function ownXp(session: Session): Promise<XpRow[]> {
  const out: XpRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await session.supabase
      .from("xp_events")
      .select("amount, reason, ref, created_at")
      .order("id")
      .range(from, from + PAGE - 1);
    const rows = data ?? [];
    out.push(
      ...rows.map((r) => ({
        amount: r.amount,
        reason: r.reason as XpReason,
        ref: r.ref,
        createdAt: r.created_at,
      })),
    );
    if (rows.length < PAGE) return out;
  }
}

export type Me = {
  handle: string | null;
  timeZone: string;
  goal: number;
  leagueOptOut: boolean;
  totalXp: number;
  todayXp: number;
  today: LocalDate;
  streak: StreakState;
  solved: Set<string>;
};

export async function readMe(session: Session, now: Date = new Date()): Promise<Me | null> {
  const { data: profile } = await session.supabase
    .from("profiles")
    .select("handle, timezone, daily_goal_minutes, league_opt_out")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!profile) return null;
  const rows = await ownXp(session);
  const today = localDate(now, profile.timezone);
  const { goals, repairs } = goalAndRepairDays(rows);
  const solved = new Set(
    rows.filter((r) => r.reason === "exercise").map((r) => parseRef(r.ref).id ?? ""),
  );
  return {
    handle: profile.handle,
    timeZone: profile.timezone,
    goal: goalXp(profile.daily_goal_minutes),
    leagueOptOut: profile.league_opt_out,
    totalXp: rows.reduce((s, r) => s + r.amount, 0),
    todayXp: rows
      .filter((r) => r.reason !== "daily_goal" && r.reason !== "streak_repair")
      .filter((r) => localDate(new Date(r.createdAt), profile.timezone) === today)
      .reduce((s, r) => s + r.amount, 0),
    today,
    streak: replayStreak(goals, repairs, today),
    solved,
  };
}

export type LeagueView = {
  week: LocalDate;
  tier: number;
  tierSlug: string;
  mode: "shared" | "split";
  me: string;
  members: { userId: string; handle: string | null; weeklyXp: number; rank: number }[];
};

/** My group this week, ranked (handles only where the profile is public). */
export async function readLeague(
  session: Session,
  now: Date = new Date(),
): Promise<LeagueView | null> {
  const week = leagueWeek(now);
  const { data: mine } = await session.supabase
    .from("league_memberships")
    .select("league_id, group_no")
    .eq("user_id", session.user.id)
    .eq("week_start", week)
    .maybeSingle();
  if (!mine) return null;
  const { data: group } = await session.supabase
    .from("league_memberships")
    .select("user_id, weekly_xp")
    .eq("week_start", week)
    .eq("league_id", mine.league_id)
    .eq("group_no", mine.group_no);
  const rows = [...(group ?? [])].sort(
    (a, b) => b.weekly_xp - a.weekly_xp || (a.user_id < b.user_id ? -1 : 1),
  );
  const { data: names } = await session.supabase
    .from("public_profiles")
    .select("id, handle")
    .in(
      "id",
      rows.map((r) => r.user_id),
    );
  const handle = new Map((names ?? []).map((n) => [n.id, n.handle]));
  const active = rows.filter((r) => r.weekly_xp > 0).length;
  return {
    week,
    tier: mine.league_id,
    tierSlug: TIERS.find((t) => t.id === mine.league_id)?.slug ?? "bernoulli",
    mode: modeFor(await weekActiveCount(week, active)),
    me: session.user.id,
    members: rows.map((r, i) => ({
      userId: r.user_id,
      handle: r.user_id === session.user.id ? null : (handle.get(r.user_id) ?? null),
      weeklyXp: r.weekly_xp,
      rank: i + 1,
    })),
  };
}

/** Active learners this week across all groups (a count only; RLS hides other groups). */
async function weekActiveCount(week: LocalDate, fallback: number): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return fallback;
  const { count } = await admin
    .from("league_memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("week_start", week)
    .gt("weekly_xp", 0);
  return count ?? fallback;
}

export async function readRatings(session: Session): Promise<Map<string, number>> {
  const { data } = await session.supabase.from("topic_ratings").select("topic, rating");
  return new Map((data ?? []).map((r) => [r.topic, r.rating]));
}

export async function readAchievements(session: Session): Promise<Set<string>> {
  const { data } = await session.supabase.from("user_achievements").select("achievement_id");
  return new Set((data ?? []).map((r) => r.achievement_id));
}

/** Published exercises only: what the dashboard may recommend or feature. */
const published = () => allExercises().filter((e) => isVisible(e, false));

export function recommendedExercise(ratings: Map<string, number>, solved: Set<string>) {
  return recommend(ratings, published(), solved);
}

/**
 * One problem per level for a Warsaw date (Phase 15), the same for everyone. Curated rows
 * in `daily_problems` win; otherwise a deterministic pick among that level's exercises.
 * `internal` deployments (previews, e2e) may pick the labelled samples, so the flow can
 * be seen and tested before real exercises exist.
 */
export async function problemsOfTheDay(
  now: Date = new Date(),
  internal = false,
): Promise<{ day: LocalDate; byLevel: Map<number, Exercise> }> {
  const day = localDate(now, LEAGUE.timeZone);
  const pool = allExercises().filter((e) => isVisible(e, internal));
  const curated = new Map<number, string>();
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin.from("daily_problems").select("level, exercise_id").eq("day", day);
    for (const r of data ?? []) curated.set(r.level, r.exercise_id);
  }
  const byLevel = new Map<number, Exercise>();
  for (const level of [1, 2, 3, 4, 5]) {
    const pick =
      pool.find((e) => e.id === curated.get(level)) ??
      pickOfDay(
        pool.filter((e) => e.level === level),
        day,
      );
    if (pick) byLevel.set(level, pick);
  }
  return { day, byLevel };
}

/** The problem of the day (Warsaw date), the same for everyone, signed in or not. */
export function problemOfTheDay(now: Date = new Date()) {
  return pickOfDay(published(), localDate(now, LEAGUE.timeZone));
}
