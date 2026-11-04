import "server-only";

import { sendAlert } from "@/features/alerts/send";

import type { Admin } from "./server";

/**
 * Cron run history (Phase 18c): every run of the three cron routes leaves a row in
 * `cron_runs` (start, finish, ok, a short summary), shown on /admin/system. Recording
 * never breaks the job: if the row can't be written, the job runs anyway.
 */
export type CronJob = "leagues" | "calibrate" | "notify" | "newsletter" | "retention";

/** A failed run alerts at once (Phase 22a); late runs are found by /api/health/crons. */
async function alertFailed(job: CronJob, why: string) {
  await sendAlert({
    key: `cron-failed-${job}`,
    subject: `Cron job failed: ${job}`,
    text: `The ${job} job failed (${why}). Details on /admin/system.`,
  }).catch(() => undefined);
}

export async function recordRun(admin: Admin, job: CronJob, run: () => Promise<Response>) {
  let runId: number | null = null;
  try {
    const { data } = await admin.from("cron_runs").insert({ job }).select("id").maybeSingle();
    runId = data?.id ?? null;
  } catch {
    // No history this time; the job itself still runs.
  }
  const finish = async (ok: boolean, details: Record<string, unknown>) => {
    if (runId === null) return;
    try {
      await admin
        .from("cron_runs")
        .update({
          finished_at: new Date().toISOString(),
          ok,
          details: JSON.parse(JSON.stringify(details)) as never,
        })
        .eq("id", runId);
    } catch {
      // As above: recording is best effort.
    }
  };
  try {
    const res = await run();
    const body: unknown = await res
      .clone()
      .json()
      .catch(() => null);
    await finish(res.ok, { status: res.status, body });
    // A job that answers 503 is dormant (not configured), not failing.
    if (!res.ok && res.status !== 503) await alertFailed(job, `HTTP ${String(res.status)}`);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 300) : "failed";
    await finish(false, { error: message });
    await alertFailed(job, message);
    throw e;
  }
}
