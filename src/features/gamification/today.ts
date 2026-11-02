import type { LocalDate } from "./days";

/**
 * Small pure helpers for the home dashboard (Phase 14).
 */

/** The first lesson in textbook order that isn't completed yet. */
export function nextLesson<T extends { id: string }>(
  inOrder: readonly T[],
  status: (id: string) => string | undefined,
): T | null {
  return inOrder.find((l) => !["completed", "mastered"].includes(status(l.id) ?? "")) ?? null;
}

/** One exercise per day, the same for everyone on that date, cycling through all of them. */
export function pickOfDay<T extends { id: string }>(items: readonly T[], day: LocalDate): T | null {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : 1));
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  // A fixed odd multiplier spreads consecutive days across the list.
  const i = (((dayNumber * 7919) % sorted.length) + sorted.length) % sorted.length;
  return sorted[i] ?? null;
}

/** Progress toward the daily goal as 0–1 (for the ring). */
export const goalShare = (xp: number, goal: number) =>
  goal <= 0 ? 1 : Math.min(1, Math.max(0, xp / goal));
