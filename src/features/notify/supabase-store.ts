import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { addDays, leagueWeek, localDate, type LocalDate } from "@/features/gamification/days";
import { goalAndRepairDays, type XpRow } from "@/features/gamification/facts";
import { replayStreak } from "@/features/gamification/streak";
import type { XpReason } from "@/features/gamification/xp";
import type { Database } from "@/lib/db/database.types";

import { DEFAULT_PREFS } from "./rules";
import type { NotifyStore, Recipient } from "./run";

/**
 * Who the daily run might notify (Phase 15), read with the secret key: profiles,
 * preferences, sign-in emails, the XP log (streak and last week) and league rows.
 * One query per learner for the XP log: fine at launch scale; batch it if it grows.
 */
type Admin = SupabaseClient<Database>;
const PAGE = 1000;

async function emails(admin: Admin): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) break;
    for (const u of data.users) if (u.email) out.set(u.id, u.email);
    if (data.users.length < PAGE) break;
  }
  return out;
}

export function supabaseNotifyStore(admin: Admin): NotifyStore {
  return {
    async recipients(now) {
      const [profiles, prefs, mail] = await Promise.all([
        admin.from("profiles").select("id, locale, timezone").not("onboarded_at", "is", null),
        admin.from("notification_prefs").select("*"),
        emails(admin),
      ]);
      const prefsBy = new Map((prefs.data ?? []).map((p) => [p.user_id, p]));
      const lastWeek: LocalDate = addDays(leagueWeek(now), -7);
      const out: Recipient[] = [];
      for (const p of profiles.data ?? []) {
        const pr = prefsBy.get(p.id);
        const { data: xp } = await admin
          .from("xp_events")
          .select("amount, reason, ref, created_at")
          .eq("user_id", p.id)
          .order("id")
          .limit(20_000);
        const rows: XpRow[] = (xp ?? []).map((r) => ({
          amount: r.amount,
          reason: r.reason as XpReason,
          ref: r.ref,
          createdAt: r.created_at,
        }));
        const { goals, repairs } = goalAndRepairDays(rows);
        const streak = replayStreak(goals, repairs, localDate(now, p.timezone));
        const inLastWeek = rows.filter((r) => leagueWeek(new Date(r.createdAt)) === lastWeek);
        const { data: league } = await admin
          .from("league_memberships")
          .select("week_start, league_id, group_no, final_rank, leagues(slug)")
          .eq("user_id", p.id)
          .in("week_start", [lastWeek, leagueWeek(now)]);
        const last = league?.find((l) => l.week_start === lastWeek);
        const next = league?.find((l) => l.week_start !== lastWeek);
        let leagueResult: Recipient["league"] = null;
        if (last?.final_rank) {
          const { count } = await admin
            .from("league_memberships")
            .select("user_id", { count: "exact", head: true })
            .eq("week_start", lastWeek)
            .eq("league_id", last.league_id)
            .eq("group_no", last.group_no);
          leagueResult = {
            tier: last.leagues.slug,
            rank: last.final_rank,
            size: count ?? last.final_rank,
            outcome: !next
              ? "stayed"
              : next.league_id > last.league_id
                ? "promoted"
                : next.league_id < last.league_id
                  ? "demoted"
                  : "stayed",
          };
        }
        out.push({
          userId: p.id,
          email: mail.get(p.id) ?? null,
          locale: p.locale === "en" ? "en" : "pl",
          timeZone: p.timezone,
          prefs: pr
            ? {
                streak: pr.email_streak,
                weekly: pr.email_weekly,
                league: pr.email_league,
                push: pr.push_enabled,
                quietStart: pr.quiet_start,
                quietEnd: pr.quiet_end,
              }
            : DEFAULT_PREFS,
          streak: { current: streak.current, atRisk: streak.atRisk },
          weekly: {
            xp: inLastWeek.reduce((s, r) => s + r.amount, 0),
            goalDays: inLastWeek.filter((r) => r.reason === "daily_goal").length,
            solved: inLastWeek.filter((r) => r.reason === "exercise").length,
          },
          league: leagueResult,
        });
      }
      return out;
    },
    async sent(userId, key) {
      const { count } = await admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("payload->>key", key);
      return (count ?? 0) > 0;
    },
    async markSent(userId, key, kind, payload) {
      await admin.from("notifications").insert({
        user_id: userId,
        kind,
        payload: JSON.parse(JSON.stringify({ ...payload, key })),
      });
    },
    async pushSubscriptions(userId) {
      const { data } = await admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId);
      return data ?? [];
    },
    async dropSubscription(endpoint) {
      await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
    },
  };
}
