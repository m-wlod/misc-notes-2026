/**
 * Dashboard helpers (Phase 18), pure. The numbers come from `admin_metrics` and
 * `admin_retention` (SQL); this only picks the range and shapes them for display.
 */
export type MetricRow = {
  day: string;
  active_users: number;
  wau: number;
  signups: number;
  lessons_completed: number;
  attempts: number;
};

export type RetentionRow = { cohort: string; size: number; week: number; active: number };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_RANGE_DAYS = 366;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The date range from the query string: last 30 days by default, at most a year. */
export function parseRange(
  search: { od?: string | string[]; do?: string | string[] },
  today: Date,
): { from: string; to: string } {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const rawTo = pick(search.do);
  const rawFrom = pick(search.od);
  const to = rawTo && DAY.test(rawTo) && !Number.isNaN(Date.parse(rawTo)) ? rawTo : iso(today);
  const defaultFrom = iso(new Date(Date.parse(to) - 29 * 86_400_000));
  let from =
    rawFrom && DAY.test(rawFrom) && !Number.isNaN(Date.parse(rawFrom)) ? rawFrom : defaultFrom;
  if (from > to) from = to;
  const earliest = iso(new Date(Date.parse(to) - (MAX_RANGE_DAYS - 1) * 86_400_000));
  if (from < earliest) from = earliest;
  return { from, to };
}

export function totals(rows: readonly MetricRow[]) {
  const last = rows.at(-1);
  return {
    dau: last?.active_users ?? 0,
    wau: last?.wau ?? 0,
    signups: rows.reduce((s, r) => s + r.signups, 0),
    lessons: rows.reduce((s, r) => s + r.lessons_completed, 0),
    attempts: rows.reduce((s, r) => s + r.attempts, 0),
  };
}

/** Cohort rows → one row per cohort with the active share per week (null: not reached). */
export function cohortTable(rows: readonly RetentionRow[], weeks: number) {
  const byCohort = new Map<string, { size: number; shares: (number | null)[] }>();
  for (const r of rows) {
    const entry = byCohort.get(r.cohort) ?? {
      size: r.size,
      shares: Array.from({ length: weeks + 1 }, () => null),
    };
    if (r.week <= weeks) entry.shares[r.week] = r.size > 0 ? r.active / r.size : 0;
    byCohort.set(r.cohort, entry);
  }
  return [...byCohort].map(([cohort, v]) => ({ cohort, ...v }));
}
