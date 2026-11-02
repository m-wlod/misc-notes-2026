import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";

import type { XpRow } from "../facts";
import type { XpReason } from "../xp";
import type { GamificationStore, Membership } from "./store";

/**
 * The award store on Supabase (Phase 14), with the secret-key client: XP, streaks,
 * league rows, ratings and achievements are server-written (no insert policies). Every
 * call is scoped to the user id the server action got from the session.
 */
type Admin = SupabaseClient<Database>;
const PAGE = 1000;

async function all<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error("gamification store: read failed");
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return out;
  }
}

type MemberRow = Database["public"]["Tables"]["league_memberships"]["Row"];
const toMembership = (r: MemberRow): Membership => ({
  userId: r.user_id,
  week: r.week_start,
  tier: r.league_id,
  group: r.group_no,
  weeklyXp: r.weekly_xp,
  finalRank: r.final_rank,
  joinedAt: 0,
});

export function supabaseStore(admin: Admin): GamificationStore {
  return {
    async profile(userId) {
      const { data } = await admin
        .from("profiles")
        .select("timezone, daily_goal_minutes, league_opt_out")
        .eq("id", userId)
        .maybeSingle();
      return data
        ? {
            timeZone: data.timezone,
            dailyGoalMinutes: data.daily_goal_minutes,
            leagueOptOut: data.league_opt_out,
          }
        : null;
    },
    async insertXp(userId, ev) {
      const { data, error } = await admin
        .from("xp_events")
        .upsert(
          {
            user_id: userId,
            amount: ev.amount,
            reason: ev.reason,
            ref: ev.ref,
            idempotency_key: ev.key,
            created_at: ev.at.toISOString(),
          },
          { onConflict: "idempotency_key", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw new Error("gamification store: xp insert failed");
      return data.length > 0;
    },
    async xpRows(userId) {
      const rows = await all((from, to) =>
        admin
          .from("xp_events")
          .select("amount, reason, ref, created_at")
          .eq("user_id", userId)
          .order("id")
          .range(from, to),
      );
      return rows.map((r): XpRow => ({
        amount: r.amount,
        reason: r.reason as XpReason,
        ref: r.ref,
        createdAt: r.created_at,
      }));
    },
    async saveStreak(userId, s) {
      await admin.from("streaks").upsert({
        user_id: userId,
        current_days: s.current,
        longest_days: s.longest,
        last_active_date: s.lastActive,
        freezes: s.freezes,
      });
    },
    async membership(userId, week) {
      const { data } = await admin
        .from("league_memberships")
        .select("*")
        .eq("user_id", userId)
        .eq("week_start", week)
        .maybeSingle();
      return data ? toMembership(data) : null;
    },
    async lastMembership(userId, before) {
      const { data } = await admin
        .from("league_memberships")
        .select("*")
        .eq("user_id", userId)
        .lt("week_start", before)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const { count } = await admin
        .from("league_memberships")
        .select("user_id", { count: "exact", head: true })
        .eq("week_start", data.week_start)
        .eq("league_id", data.league_id)
        .eq("group_no", data.group_no);
      return { ...toMembership(data), groupSize: count ?? 1 };
    },
    async groupSizes(week, tier) {
      const rows = await all((from, to) =>
        admin
          .from("league_memberships")
          .select("group_no")
          .eq("week_start", week)
          .eq("league_id", tier)
          .range(from, to),
      );
      const sizes = new Map<number, number>();
      for (const r of rows) sizes.set(r.group_no, (sizes.get(r.group_no) ?? 0) + 1);
      return sizes;
    },
    async weekActive(week) {
      const { count } = await admin
        .from("league_memberships")
        .select("user_id", { count: "exact", head: true })
        .eq("week_start", week)
        .gt("weekly_xp", 0);
      return count ?? 0;
    },
    async upsertMembership(m) {
      await admin.from("league_memberships").upsert(
        {
          user_id: m.userId,
          week_start: m.week,
          league_id: m.tier,
          group_no: m.group,
          weekly_xp: m.weeklyXp,
        },
        { onConflict: "user_id,week_start" },
      );
    },
    async leagueHistory(userId) {
      const { data } = await admin
        .from("league_memberships")
        .select("week_start, league_id, final_rank")
        .eq("user_id", userId);
      return (data ?? []).map((r) => ({
        week: r.week_start,
        tier: r.league_id,
        finalRank: r.final_rank,
      }));
    },
    async weekMembers(week) {
      const rows = await all((from, to) =>
        admin
          .from("league_memberships")
          .select("*")
          .eq("week_start", week)
          .order("user_id")
          .range(from, to),
      );
      return rows.map(toMembership);
    },
    async unrolledWeeks(before) {
      const rows = await all((from, to) =>
        admin
          .from("league_memberships")
          .select("week_start")
          .is("final_rank", null)
          .lt("week_start", before)
          .order("week_start")
          .range(from, to),
      );
      return [...new Set(rows.map((r) => r.week_start))];
    },
    async saveRanks(week, ranks) {
      for (const r of ranks) {
        await admin
          .from("league_memberships")
          .update({ final_rank: r.rank })
          .eq("week_start", week)
          .eq("user_id", r.userId);
      }
    },
    async insertMemberships(week, rows) {
      if (rows.length === 0) return;
      await admin.from("league_memberships").upsert(
        rows.map((r) => ({
          user_id: r.userId,
          week_start: week,
          league_id: r.tier,
          group_no: r.group,
          weekly_xp: 0,
        })),
        { onConflict: "user_id,week_start", ignoreDuplicates: true },
      );
    },
    async optedOut(userIds) {
      if (userIds.length === 0) return new Set();
      const { data } = await admin
        .from("profiles")
        .select("id")
        .in("id", [...userIds])
        .eq("league_opt_out", true);
      return new Set((data ?? []).map((r) => r.id));
    },
    async ratings(userId) {
      const { data } = await admin
        .from("topic_ratings")
        .select("topic, rating")
        .eq("user_id", userId);
      return new Map((data ?? []).map((r) => [r.topic, r.rating]));
    },
    async saveRatings(userId, ratings) {
      if (ratings.size === 0) return;
      await admin.from("topic_ratings").upsert(
        [...ratings].map(([topic, rating]) => ({
          user_id: userId,
          topic,
          rating,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,topic" },
      );
    },
    async ownedAchievements(userId) {
      const { data } = await admin
        .from("user_achievements")
        .select("achievement_id")
        .eq("user_id", userId);
      return new Set((data ?? []).map((r) => r.achievement_id));
    },
    async grantAchievements(userId, ids) {
      if (ids.length === 0) return;
      await admin.from("user_achievements").upsert(
        ids.map((id) => ({ user_id: userId, achievement_id: id })),
        { onConflict: "user_id,achievement_id", ignoreDuplicates: true },
      );
    },
  };
}
