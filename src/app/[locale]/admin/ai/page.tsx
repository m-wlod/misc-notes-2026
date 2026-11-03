import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton, Table, Td, Th } from "@/components/ui/display";
import { parseRange } from "@/features/admin/metrics";
import { parseCosts } from "@/features/admin/platform";
import { requirePage } from "@/features/admin/server";
import { AiSettingsForm } from "@/features/admin/ui/platform-forms";
import { quotaConfig } from "@/features/ai-grading/service";
import { Link } from "@/i18n/navigation";

type Props = PageProps<"/[locale]/admin/ai">;

/** AI grading costs per day, user and exercise, and the budget settings (Phase 18c). */
export default function AdminAiPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Costs searchParams={searchParams} />
    </Suspense>
  );
}

async function Costs({ searchParams }: Pick<Props, "searchParams">) {
  await connection();
  const { session } = await requirePage("ai");
  const t = await getTranslations("admin.ai");
  const td = await getTranslations("admin.dashboard");
  const format = await getFormatter();
  const range = parseRange(await searchParams, new Date());
  const [{ data, error }, config] = await Promise.all([
    session.supabase.rpc("admin_ai_costs", { from_day: range.from, to_day: range.to }),
    quotaConfig(),
  ]);
  const costs = error ? null : parseCosts(data);
  const usd = (v: number) =>
    format.number(v, { style: "currency", currency: "USD", maximumFractionDigits: 4 });
  const total = costs?.days.reduce((s, d) => s + d.cost, 0) ?? 0;
  const calls = costs?.days.reduce((s, d) => s + d.calls, 0) ?? 0;

  return (
    <div className="grid gap-10">
      <h1 className="text-3xl">{t("title")}</h1>

      <section aria-labelledby="ai-settings" className="grid gap-3">
        <h2 id="ai-settings" className="text-xl">
          {t("settings")}
        </h2>
        <p className="max-w-prose text-sm text-ink-muted">{t("settingsNote")}</p>
        <p className="font-sans text-sm" data-ai-current>
          {t("current", {
            budget: config.dailyBudgetUsd,
            quota: config.userDailyQuota,
            ip: config.ipDailyLimit,
          })}
        </p>
        <AiSettingsForm defaults={config} />
      </section>

      <form className="flex flex-wrap items-end gap-3 font-sans text-sm" aria-label={td("range")}>
        <label className="grid gap-1">
          {td("from")}
          <input
            type="date"
            name="od"
            defaultValue={range.from}
            className="rounded border border-rule-strong bg-surface px-2 py-1"
          />
        </label>
        <label className="grid gap-1">
          {td("to")}
          <input
            type="date"
            name="do"
            defaultValue={range.to}
            className="rounded border border-rule-strong bg-surface px-2 py-1"
          />
        </label>
        <Button type="submit" size="sm" variant="secondary">
          {td("show")}
        </Button>
      </form>

      {!costs ? (
        <p className="text-ink-muted">{t("error")}</p>
      ) : (
        <>
          <p className="font-sans text-sm" data-ai-total>
            {t("total")}: {usd(total)} · {t("calls")}: {calls} · {t("note")}
          </p>
          {calls === 0 ? <p className="text-ink-muted">{t("empty")}</p> : null}
          <div className="grid gap-8 xl:grid-cols-2">
            <section aria-labelledby="ai-users" className="grid content-start gap-3">
              <h2 id="ai-users" className="text-xl">
                {t("users")}
              </h2>
              <Table label={t("users")}>
                <thead>
                  <tr>
                    <Th>{t("user")}</Th>
                    <Th>{t("calls")}</Th>
                    <Th>{t("cost")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {costs.users.map((u) => (
                    <tr key={u.user_id} data-ai-user={u.user_id}>
                      <Td>
                        <Link
                          href={{ pathname: "/admin/uzytkownicy/[id]", params: { id: u.user_id } }}
                        >
                          {u.handle ?? u.user_id}
                        </Link>
                      </Td>
                      <Td>{u.calls}</Td>
                      <Td>{usd(u.cost)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </section>
            <section aria-labelledby="ai-exercises" className="grid content-start gap-3">
              <h2 id="ai-exercises" className="text-xl">
                {t("exercises")}
              </h2>
              <Table label={t("exercises")}>
                <thead>
                  <tr>
                    <Th>{t("exercise")}</Th>
                    <Th>{t("calls")}</Th>
                    <Th>{t("cost")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {costs.exercises.map((e) => (
                    <tr key={e.exercise_id ?? ""} data-ai-exercise={e.exercise_id ?? ""}>
                      <Td>
                        {e.exercise_id ? (
                          <Link
                            href={{
                              pathname: "/admin/zadania/[id]",
                              params: { id: e.exercise_id },
                            }}
                          >
                            {e.exercise_id}
                          </Link>
                        ) : (
                          t("unknown")
                        )}
                      </Td>
                      <Td>{e.calls}</Td>
                      <Td>{usd(e.cost)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </section>
          </div>
          <details>
            <summary className="cursor-pointer font-sans text-sm">{t("days")}</summary>
            <Table label={t("days")} className="mt-3">
              <thead>
                <tr>
                  <Th>{t("day")}</Th>
                  <Th>{t("calls")}</Th>
                  <Th>{t("cost")}</Th>
                </tr>
              </thead>
              <tbody>
                {costs.days.map((d) => (
                  <tr key={d.day} data-ai-day={d.day}>
                    <Td>{d.day}</Td>
                    <Td>{d.calls}</Td>
                    <Td>{usd(d.cost)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </details>
        </>
      )}
    </div>
  );
}
