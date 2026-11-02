import { addDays, leagueWeek, type LocalDate } from "../days";
import { rollWeek } from "../league";
import type { GamificationStore } from "./store";

/**
 * The weekly league roll (Phase 14), run by the cron. Rolls every finished week that
 * still has members without a final rank, oldest first, so a missed run catches up and
 * a repeated run does nothing.
 */
export async function rollFinishedWeeks(store: GamificationStore, now: Date = new Date()) {
  const current = leagueWeek(now);
  const rolled: { week: LocalDate; mode: string; members: number; next: number }[] = [];
  for (const week of (await store.unrolledWeeks(current)).sort()) {
    const all = await store.weekMembers(week);
    const opted = await store.optedOut(all.map((m) => m.userId));
    const members = all.filter((m) => !opted.has(m.userId));
    const active = members.filter((m) => m.weeklyXp > 0).length;
    const res = rollWeek(members, active);
    await store.saveRanks(
      week,
      res.ranked.map((r) => ({ userId: r.userId, rank: r.rank })),
    );
    // Opted-out members get a rank-less row closed too, so the week counts as rolled.
    if (opted.size > 0) {
      await store.saveRanks(
        week,
        all.filter((m) => opted.has(m.userId)).map((m) => ({ userId: m.userId, rank: 0 })),
      );
    }
    await store.insertMemberships(addDays(week, 7), res.next);
    rolled.push({ week, mode: res.mode, members: members.length, next: res.next.length });
  }
  return rolled;
}
