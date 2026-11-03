import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton, Table, Td, Th } from "@/components/ui/display";
import type { CronJob } from "@/features/admin/cron-runs";
import { requirePage } from "@/features/admin/server";
import { leagueWeek } from "@/features/gamification/days";

/** Cron jobs' last runs and this week's league (Phase 18c, admins only). */
export default function AdminSystemPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <System />
    </Suspense>
  );
}

const JOBS: readonly CronJob[] = ["leagues", "calibrate", "notify", "newsletter"];

async function System() {
  await connection();
  const { admin } = await requirePage("system");
  const t = await getTranslations("admin.system");
  const format = await getFormatter();
  const week = leagueWeek(new Date());
  const [runs, members, rolled] = await Promise.all([
    Promise.all(
      JOBS.map((job) =>
        admin
          .from("cron_runs")
          .select("job, started_at, finished_at, ok, details")
          .eq("job", job)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
    ),
    admin
      .from("league_memberships")
      .select("league_id, group_no, weekly_xp")
      .eq("week_start", week),
    admin
      .from("league_memberships")
      .select("week_start")
      .not("final_rank", "is", null)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const rows = members.data ?? [];
  const groups = new Set(rows.map((r) => `${String(r.league_id)}:${String(r.group_no)}`)).size;
  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Warsaw",
    });

  return (
    <div className="grid gap-10">
      <h1 className="text-3xl">{t("title")}</h1>
      <section aria-labelledby="cron-title" className="grid gap-3">
        <h2 id="cron-title" className="text-xl">
          {t("cron")}
        </h2>
        <Table label={t("cron")}>
          <thead>
            <tr>
              <Th>{t("job")}</Th>
              <Th>{t("lastRun")}</Th>
              <Th>{t("status")}</Th>
              <Th>{t("details")}</Th>
            </tr>
          </thead>
          <tbody>
            {JOBS.map((job, i) => {
              const run = runs[i]?.data;
              const status = !run
                ? t("never")
                : run.ok === null
                  ? t("running")
                  : run.ok
                    ? t("ok")
                    : t("failed");
              return (
                <tr key={job} data-cron={job} data-ok={run?.ok ?? ""}>
                  <Td>{t(`jobs.${job}`)}</Td>
                  <Td>{run ? when(run.started_at) : ""}</Td>
                  <Td>{status}</Td>
                  <Td>
                    {run?.details ? (
                      <code className="text-xs break-all">
                        {JSON.stringify(run.details).slice(0, 200)}
                      </code>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </section>
      <section aria-labelledby="league-title" className="grid gap-3">
        <h2 id="league-title" className="text-xl">
          {t("league")}
        </h2>
        <p className="font-sans text-sm text-ink-muted">{t("week", { week })}</p>
        <dl className="grid grid-cols-2 gap-3 font-sans sm:grid-cols-4">
          {(
            [
              ["members", rows.length],
              ["groups", groups],
              ["activeMembers", rows.filter((r) => r.weekly_xp > 0).length],
              ["lastRoll", rolled.data?.week_start ?? t("none")],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-md border border-rule px-3 py-2">
              <dt className="text-xs text-ink-muted">{t(k)}</dt>
              <dd className="text-2xl tabular-nums" data-league={k}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
