import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton, Table, Td, Th } from "@/components/ui/display";
import {
  answerText,
  mistakeSnippet,
  mistakeValue,
  parseAnalytics,
} from "@/features/admin/analytics";
import { requirePage } from "@/features/admin/server";
import { allExercises } from "@/features/exercises/data";
import { Link } from "@/i18n/navigation";

type Props = PageProps<"/[locale]/admin/zadania/[id]">;

export function generateStaticParams() {
  return allExercises()
    .slice(0, 1)
    .map((e) => ({ id: e.id }));
}

/**
 * One exercise's analytics (Phase 18b, all staff): attempts, success rate, median time,
 * hints, and the most common wrong answers, each with a ready-to-paste `mistakes[]`
 * entry. Content files are never written from here.
 */
export default function AdminExercisePage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Exercise params={params} />
    </Suspense>
  );
}

async function Exercise({ params }: Pick<Props, "params">) {
  await connection();
  const { session } = await requirePage("exercises");
  const { id } = await params;
  const ex = allExercises().find((e) => e.id === id);
  if (!ex) notFound();
  const t = await getTranslations("admin.exercises");
  const { data, error } = await session.supabase.rpc("admin_exercise_analytics", { ex: id });
  const a = error ? null : parseAnalytics(data);
  const known = new Set(
    ("mistakes" in ex ? ex.mistakes : []).map((m) => String(m.answer).trim().toLowerCase()),
  );
  const pct = (v: number | null) => (v === null ? "–" : `${String(Math.round(v * 100))}%`);
  const seconds = (ms: number | null) =>
    ms === null ? "–" : t("seconds", { s: Math.round(ms / 1000) });

  return (
    <div className="grid gap-6" data-admin-exercise={ex.id}>
      <p className="font-sans text-sm">
        <Link href="/admin/zadania">{t("back")}</Link>
      </p>
      <h1 className="text-3xl">{ex.id}</h1>
      <p className="max-w-prose font-serif text-ink-muted">{ex.prompt.pl}</p>
      {!a ? (
        <p className="text-ink-muted">{t("error")}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 font-sans sm:grid-cols-5">
            {(
              [
                ["attempts", String(a.attempts)],
                ["users", String(a.users)],
                ["successRate", pct(a.success_rate)],
                ["medianTime", seconds(a.median_time_ms)],
                ["meanHints", a.mean_hints === null ? "–" : String(a.mean_hints)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-md border border-rule px-3 py-2">
                <dt className="text-xs text-ink-muted">{t(k)}</dt>
                <dd className="text-2xl tabular-nums" data-stat={k}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <section aria-labelledby="wrong-title" className="grid gap-3">
            <h2 id="wrong-title" className="text-xl">
              {t("wrong")}
            </h2>
            {a.wrong.length === 0 ? (
              <p className="text-ink-muted">{t("noWrong")}</p>
            ) : (
              <Table label={t("wrong")}>
                <thead>
                  <tr>
                    <Th>{t("answer")}</Th>
                    <Th>{t("count")}</Th>
                    <Th>{t("mistake")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {a.wrong.map((w) => {
                    const text = answerText(w.answer);
                    const value = mistakeValue(w.answer);
                    const listed = value !== null && known.has(String(value).toLowerCase());
                    return (
                      <tr key={JSON.stringify(w.answer)} data-wrong={text}>
                        <Td>{text}</Td>
                        <Td>{w.count}</Td>
                        <Td>
                          {value === null ? (
                            ""
                          ) : listed ? (
                            t("listed")
                          ) : (
                            <details>
                              <summary className="cursor-pointer">{t("addMistake")}</summary>
                              <pre className="mt-2 overflow-x-auto rounded bg-sunken p-2 text-xs">
                                <code data-snippet>{mistakeSnippet(value)}</code>
                              </pre>
                            </details>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
