import { LEAGUE } from "./config";

/**
 * Calendar days for streaks and leagues (Phase 14). An instant becomes a local date
 * (`YYYY-MM-DD`) in the user's time zone once; after that all arithmetic is on dates,
 * so a 23- or 25-hour DST day is still exactly one day.
 */
export type LocalDate = string;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The calendar date of an instant in a time zone (falls back to the league zone). */
export function localDate(instant: Date | number, timeZone: string): LocalDate {
  const zone = isTimeZone(timeZone) ? timeZone : LEAGUE.timeZone;
  const parts = formatter(zone).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const toUtc = (d: LocalDate) =>
  Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const fromUtc = (ms: number): LocalDate => new Date(ms).toISOString().slice(0, 10);

export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtc(toUtc(d) + n * 86_400_000);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** ISO weekday: Monday 1 … Sunday 7. */
export function weekday(d: LocalDate): number {
  const w = new Date(toUtc(d)).getUTCDay();
  return w === 0 ? 7 : w;
}

/** The Monday of the week containing a date. */
export function mondayOf(d: LocalDate): LocalDate {
  return addDays(d, 1 - weekday(d));
}

/** The league week an instant belongs to: its Monday in the league zone. */
export function leagueWeek(instant: Date | number): LocalDate {
  return mondayOf(localDate(instant, LEAGUE.timeZone));
}
