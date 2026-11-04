/**
 * When to alert (Phase 22a). Pure, so the rules are unit-tested; `send.ts` delivers.
 */

/** AI budget alerts: once each at 50%, 80% and 100% of the day's budget. */
export const BUDGET_THRESHOLDS = [50, 80, 100] as const;

/** Thresholds a spend increase crossed (before → after), as percentages. */
export function thresholdsCrossed(before: number, after: number, budget: number): number[] {
  if (budget <= 0) return [];
  return BUDGET_THRESHOLDS.filter(
    (t) => (before / budget) * 100 < t && (after / budget) * 100 >= t,
  );
}

/**
 * How often each cron runs (vercel.json) and how late a run may be before it counts as
 * missing: the interval plus a grace period for a slow or retried run.
 */
const HOUR = 3_600_000;
export const CRON_SCHEDULE = {
  leagues: { everyMs: 24 * HOUR, graceMs: 3 * HOUR },
  calibrate: { everyMs: 24 * HOUR, graceMs: 3 * HOUR },
  notify: { everyMs: 24 * HOUR, graceMs: 3 * HOUR },
  retention: { everyMs: 24 * HOUR, graceMs: 3 * HOUR },
  newsletter: { everyMs: 7 * 24 * HOUR, graceMs: 6 * HOUR },
} as const;
export type ScheduledJob = keyof typeof CRON_SCHEDULE;
export const SCHEDULED_JOBS = Object.keys(CRON_SCHEDULE) as ScheduledJob[];

export type Run = { job: string; started_at: string; ok: boolean | null };
export type JobHealth = {
  job: ScheduledJob;
  status: "ok" | "late" | "failed" | "never";
  lastOk: string | null;
};

/**
 * Each job's health from its recent runs: failed if the latest finished run failed, late
 * if the last successful run is older than the interval plus grace, never if none ran.
 */
export function cronHealth(runs: readonly Run[], now: number): JobHealth[] {
  return SCHEDULED_JOBS.map((job) => {
    const mine = runs
      .filter((r) => r.job === job && r.ok !== null)
      .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
    const lastOk = mine.find((r) => r.ok)?.started_at ?? null;
    const latest = mine[0];
    const { everyMs, graceMs } = CRON_SCHEDULE[job];
    const status: JobHealth["status"] =
      latest === undefined
        ? "never"
        : latest.ok === false
          ? "failed"
          : lastOk === null || now - Date.parse(lastOk) > everyMs + graceMs
            ? "late"
            : "ok";
    return { job, status, lastOk };
  });
}

export const healthy = (jobs: readonly JobHealth[]) => jobs.every((j) => j.status === "ok");
