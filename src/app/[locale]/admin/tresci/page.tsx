import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { debunk, exercises as exerciseFiles, lessons } from "#content";
import { Button } from "@/components/ui/button";
import { Skeleton, Table, Td, Th } from "@/components/ui/display";
import {
  contentRows,
  filterRows,
  summarize,
  type ContentFilter,
  type ContentKind,
  type Status,
} from "@/features/admin/content-status";
import { requirePage } from "@/features/admin/server";
import { allExercises } from "@/features/exercises/data";
import { Link } from "@/i18n/navigation";

import todoCounts from "../../../../../.velite/content-todos.json";
import { curriculum } from "../../../../../content/curriculum";

type Props = PageProps<"/[locale]/admin/tresci">;

/**
 * Content status (Phase 18b): every lesson, exercise and debunk entry with its status,
 * missing English versions, open `TODO(verify)` markers and calibration flags. Built
 * from the content build; only the calibration needs the database.
 */
export default function AdminContentPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ContentStatus searchParams={searchParams} />
    </Suspense>
  );
}

const KINDS: readonly ContentKind[] = ["lesson", "exercise", "debunk"];
const STATUSES: readonly Status[] = ["draft", "review", "published"];

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function ContentStatus({ searchParams }: Pick<Props, "searchParams">) {
  await connection();
  const { admin } = await requirePage("content");
  const t = await getTranslations("admin.content");
  const sp = await searchParams;
  const kind = KINDS.find((k) => k === one(sp.typ));
  const status = STATUSES.find((s) => s === one(sp.status));
  const tracks = curriculum.map((tr) => tr.id);
  const track = tracks.find((tr) => tr === one(sp.sciezka));
  const filter: ContentFilter = { kind, status, track, attention: one(sp.uwaga) === "1" };

  const { data: stats } = await admin
    .from("exercise_stats")
    .select("exercise_id, attempts, success_rate, median_time_ms");
  const trackOf = new Map(
    curriculum.flatMap((tr) =>
      tr.modules.flatMap((m) => m.lessons.map((l) => [l, tr.id] as const)),
    ),
  );
  const fileOf = new Map(exerciseFiles.map((f) => [(f.data as { id: string }).id, f.file]));
  const rows = contentRows({
    lessons,
    exercises: allExercises().map((e) => ({
      id: e.id,
      level: e.level,
      status: e.status,
      lessonIds: e.lessonIds,
      promptPl: e.prompt.pl,
      hasEn: e.prompt.en !== undefined,
      file: fileOf.get(e.id) ?? "",
    })),
    debunk,
    trackOf,
    todos: todoCounts,
    stats: (stats ?? []).map((s) => ({
      exerciseId: s.exercise_id,
      attempts: s.attempts,
      successRate: s.success_rate ?? 0,
      medianTimeMs: s.median_time_ms,
    })),
  });
  const total = summarize(rows);
  const shown = filterRows(rows, filter);

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">{t("title")}</h1>
      <dl className="grid grid-cols-2 gap-3 font-sans sm:grid-cols-3 xl:grid-cols-6">
        {(["draft", "review", "published", "missingEn", "todos", "flagged"] as const).map((k) => (
          <div key={k} className="rounded-md border border-rule px-3 py-2">
            <dt className="text-xs text-ink-muted">{t(`summary.${k}`)}</dt>
            <dd className="text-2xl tabular-nums" data-summary={k}>
              {total[k]}
            </dd>
          </div>
        ))}
      </dl>
      <form className="flex flex-wrap items-end gap-3 font-sans text-sm">
        <label className="grid gap-1">
          {t("filter.kind")}
          <select
            name="typ"
            defaultValue={kind ?? ""}
            className="rounded border border-rule-strong bg-surface px-2 py-1"
          >
            <option value="">{t("filter.all")}</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          {t("filter.status")}
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded border border-rule-strong bg-surface px-2 py-1"
          >
            <option value="">{t("filter.all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          {t("filter.track")}
          <select
            name="sciezka"
            defaultValue={track ?? ""}
            className="rounded border border-rule-strong bg-surface px-2 py-1"
          >
            <option value="">{t("filter.all")}</option>
            {curriculum.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name.pl}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 py-1">
          <input type="checkbox" name="uwaga" value="1" defaultChecked={filter.attention} />
          {t("filter.attention")}
        </label>
        <Button type="submit" size="sm" variant="secondary">
          {t("filter.apply")}
        </Button>
      </form>
      <p className="font-sans text-sm text-ink-muted" role="status">
        {t("shown", { shown: shown.length, total: rows.length })}
      </p>
      <Table label={t("title")}>
        <thead>
          <tr>
            <Th>{t("col.kind")}</Th>
            <Th>{t("col.id")}</Th>
            <Th>{t("col.title")}</Th>
            <Th>{t("col.status")}</Th>
            <Th>{t("col.en")}</Th>
            <Th>{t("col.todos")}</Th>
            <Th>{t("col.calibration")}</Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={`${r.kind}:${r.id}`} data-content={`${r.kind}:${r.id}`}>
              <Td>{t(`kind.${r.kind}`)}</Td>
              <Td>
                {r.kind === "exercise" ? (
                  <Link href={{ pathname: "/admin/zadania/[id]", params: { id: r.id } }}>
                    {r.id}
                  </Link>
                ) : (
                  r.id
                )}
              </Td>
              <Td>{r.title}</Td>
              <Td>{t(`status.${r.status}`)}</Td>
              <Td>{r.missingEn ? t("missing") : t("ok")}</Td>
              <Td>{r.todos > 0 ? r.todos : ""}</Td>
              <Td>{r.calibration ? t(`calibration.${r.calibration}`) : ""}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
