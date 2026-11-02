import { leagueWeek } from "@/features/gamification/days";

/** The challenge of the week an instant falls in: published, matching week (Phase 15). */
export function currentChallenge<
  T extends { week: string; status: "draft" | "published"; deadline: string },
>(all: readonly T[], now: Date): (T & { open: boolean }) | null {
  const week = leagueWeek(now);
  const c = all.find((x) => x.status === "published" && x.week === week);
  return c ? { ...c, open: now.getTime() < Date.parse(c.deadline) } : null;
}
