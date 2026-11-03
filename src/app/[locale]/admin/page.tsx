import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton, Table, Td, Th } from "@/components/ui/display";
import { cohortTable, parseRange, totals, type MetricRow } from "@/features/admin/metrics";
import { requirePage } from "@/features/admin/server";
import { ActivityChart } from "@/features/admin/ui/activity-chart";

type Props = PageProps<"/[locale]/admin">;

const RETENTION_WEEKS = 8;

/** Admin dashboard (Phase 18): activity, sign-ups, learning volume and retention. */
export default function AdminDashboardPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

function Tile({
  id,
  label,
  value,
  note,
}: {
  id: string;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-md border border-rule px-4 py-3">
      <dt className="font-sans text-xs text-ink-muted">{label}</dt>
      <dd className="num text-2xl" data-metric={id}>
        {value}
      </dd>
      {note ? <dd className="font-sans text-xs text-ink-muted">{note}</dd> : null}
    </div>
  );
}

async function Dashboard({ searchParams }: Pick<Props, "searchParams">) {
  await connection();
  const { session } = await requirePage("dashboard");
  const t = await getTranslations("admin.dashboard");
  const format = await getFormatter();
  const range = parseRange(await searchParams, new Date());
  const [metrics, retention, campaigns] = await Promise.all([
    session.supabase.rpc("admin_metrics", { from_day: range.from, to_day: range.to }),
    session.supabase.rpc("admin_retention", { weeks: RETENTION_WEEKS }),
    session.supabase.rpc("admin_utm", { from_day: range.from, to_day: range.to }),
  ]);
  if (metrics.error || retention.error) {
    return <p role="alert">{t("error")}</p>;
  }
  const rows: MetricRow[] = metrics.data;
  const sum = totals(rows);
  const n = (v: number) => format.number(v);
  const pct = (v: number) => format.number(v, { style: "percent", maximumFractionDigits: 0 });
  const cohorts = cohortTable(retention.data, RETENTION_WEEKS);

  return (
    <div className="grid gap-10" data-admin-dashboard="">
      <h1 className="text-3xl">{t("title")}</h1>

      <form className="flex flex-wrap items-end gap-3 font-sans text-sm" aria-label={t("range")}>
        <label className="grid gap-1">
          {t("from")}
          <input
            type="date"
            name="od"
            defaultValue={range.from}
            className="rounded border border-rule-strong bg-surface px-2 py-1"
          />
        </label>
        <label className="grid gap-1">
          {t("to")}
          <input
            type="date"
            name="do"
            defaultValue={range.to}
            className="rounded border border-rule-strong bg-surface px-2 py-1"
          />
        </label>
        <Button type="submit" size="sm" variant="secondary">
          {t("show")}
        </Button>
      </form>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile id="dau" label={t("dau")} value={n(sum.dau)} note={range.to} />
        <Tile id="wau" label={t("wau")} value={n(sum.wau)} note={range.to} />
        <Tile id="signups" label={t("signups")} value={n(sum.signups)} note={t("inRange")} />
        <Tile id="lessons" label={t("lessons")} value={n(sum.lessons)} note={t("inRange")} />
        <Tile id="attempts" label={t("attempts")} value={n(sum.attempts)} note={t("inRange")} />
      </dl>

      <section aria-labelledby="activity-h" className="grid gap-3">
        <h2 id="activity-h" className="text-xl">
          {t("chartTitle")}
        </h2>
        <ActivityChart
          points={rows.map((r) => ({ day: r.day, dau: r.active_users, wau: r.wau }))}
          legend={{ dau: t("dauLegend"), wau: t("wauLegend") }}
          label={t("chartLabel", {
            from: range.from,
            to: range.to,
            maxDau: Math.max(0, ...rows.map((r) => r.active_users)),
            maxWau: Math.max(0, ...rows.map((r) => r.wau)),
          })}
        />
        <details>
          <summary className="cursor-pointer font-sans text-sm">{t("table")}</summary>
          <Table label={t("table")} className="mt-3">
            <thead>
              <tr>
                <Th>{t("day")}</Th>
                <Th numeric>{t("dauLegend")}</Th>
                <Th numeric>{t("wauLegend")}</Th>
                <Th numeric>{t("signups")}</Th>
                <Th numeric>{t("lessons")}</Th>
                <Th numeric>{t("attempts")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day} data-day={r.day}>
                  <Td>{r.day}</Td>
                  <Td numeric>{r.active_users}</Td>
                  <Td numeric>{r.wau}</Td>
                  <Td numeric>{r.signups}</Td>
                  <Td numeric>{r.lessons_completed}</Td>
                  <Td numeric>{r.attempts}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </details>
      </section>

      <section aria-labelledby="retention-h" className="grid gap-3">
        <h2 id="retention-h" className="text-xl">
          {t("retention")}
        </h2>
        <p className="max-w-(--measure) font-sans text-sm text-ink-muted">{t("retentionNote")}</p>
        {cohorts.length === 0 ? (
          <p className="text-ink-muted">{t("empty")}</p>
        ) : (
          <Table label={t("retention")}>
            <thead>
              <tr>
                <Th>{t("cohort")}</Th>
                <Th numeric>{t("size")}</Th>
                {Array.from({ length: RETENTION_WEEKS + 1 }, (_, i) => (
                  <Th key={i} numeric>
                    {t("week", { n: i })}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.cohort}>
                  <Td>{c.cohort}</Td>
                  <Td numeric>{c.size}</Td>
                  {c.shares.map((s, i) => (
                    <Td key={i} numeric>
                      {s === null ? "" : pct(s)}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section aria-labelledby="campaigns-h" className="grid gap-3">
        <h2 id="campaigns-h" className="text-xl">
          {t("campaigns")}
        </h2>
        <p className="max-w-(--measure) font-sans text-sm text-ink-muted">{t("campaignsNote")}</p>
        {(campaigns.data ?? []).length === 0 ? (
          <p className="text-ink-muted">{campaigns.error ? t("error") : t("empty")}</p>
        ) : (
          <Table label={t("campaigns")}>
            <thead>
              <tr>
                <Th>{t("source")}</Th>
                <Th>{t("medium")}</Th>
                <Th>{t("campaign")}</Th>
                <Th>{t("landing")}</Th>
                <Th numeric>{t("visits")}</Th>
              </tr>
            </thead>
            <tbody>
              {(campaigns.data ?? []).map((c) => (
                <tr
                  key={`${c.source}|${c.medium}|${c.campaign}|${c.landing_path}`}
                  data-campaign={`${c.source}|${c.medium}|${c.campaign}|${c.landing_path}`}
                >
                  <Td>{c.source}</Td>
                  <Td>{c.medium}</Td>
                  <Td>{c.campaign}</Td>
                  <Td>{c.landing_path}</Td>
                  <Td numeric>{n(c.visits)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
