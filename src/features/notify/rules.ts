/**
 * When to notify (Phase 15), pure. Times are local to the learner (their time zone);
 * quiet hours may wrap midnight (22:00–07:00).
 */
export const EMAIL_KINDS = ["streak", "weekly", "league"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

/** "HH:MM" in a time zone. */
export function localTime(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now);
  } catch {
    return localTime(now, "Europe/Warsaw");
  }
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Inside [start, end) local time; a window like 22:00–07:00 wraps midnight. */
export function inQuietHours(now: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const t = minutes(now);
  const a = minutes(start);
  const b = minutes(end);
  if (a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

export type Prefs = {
  streak: boolean;
  weekly: boolean;
  league: boolean;
  push: boolean;
  quietStart: string | null;
  quietEnd: string | null;
};
export const DEFAULT_PREFS: Prefs = {
  streak: true,
  weekly: true,
  league: true,
  push: false,
  quietStart: null,
  quietEnd: null,
};

/** A reminder only makes sense for a streak at risk today, with reminders on. */
export function streakReminderDue(
  prefs: Prefs,
  streak: { current: number; atRisk: boolean },
  localNow: string,
): boolean {
  return (
    prefs.streak &&
    streak.current >= 1 &&
    streak.atRisk &&
    !inQuietHours(localNow, prefs.quietStart, prefs.quietEnd)
  );
}
