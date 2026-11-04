import "server-only";

import type { Admin } from "./server";

/**
 * Cron run history (Phase 18c): every run of the three cron routes leaves a row in
 * `cron_runs` (start, finish, ok, a short summary), shown on /admin/system. Recording
 * never breaks the job: if the row can't be written, the job runs anyway.
 */
export type CronJob = "leagues" | "calibrate" | "notify" | "newsletter" | "retention";

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
    return res;
  } catch (e) {
    await finish(false, { error: e instanceof Error ? e.message.slice(0, 300) : "failed" });
    throw e;
  }
}
