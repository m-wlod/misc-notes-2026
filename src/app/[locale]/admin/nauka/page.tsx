import { connection } from "next/server";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton, Table, Td, Th } from "@/components/ui/display";
import { hintsByLevel, lessonDropoff } from "@/features/admin/learning";
import { parseRange } from "@/features/admin/metrics";
import { requirePage } from "@/features/admin/server";
import { lessonTitles } from "@/features/curriculum";
import { allExercises } from "@/features/exercises/data";
import { flags } from "@/features/grading/calibrate";

type Props = PageProps<"/[locale]/admin/nauka">;

/**
 * Learning analytics (Phase 22c): where learners stop in lessons, exercises whose
 * success rate doesn't fit their level, and how much each level leans on hints. From our
 * own database only (server-graded attempts); product analytics live in PostHog.
 */
export default function AdminLearningPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Learning searchParams={searchParams} />
    </Suspense>
  );
}

async function Learning({ searchParams }: { searchParams: Props["searchParams"] }) {
  await connection();
  const { session } = await requirePage("learning");
  const t = await getTranslations("admin.learning");
  const format = await getFormatter();
  const locale = await getLocale();
  const range = parseRange(await searchParams, new Date());
  const [lessonsRes, hintsRes, statsRes] = await Promise.all([
    session.supabase.rpc("admin_learning_lessons", { from_day: range.from, to_day: range.to }),
    session.supabase.rpc("admin_learning_hints", { from_day: range.from, to_day: range.to }),
    session.supabase.from("exercise_stats").select("exercise_id, attempts, success_rate"),
  ]);
  const titles = lessonTitles(locale);
  const exercises = new Map(allExercises().map((e) => [e.id, e]));
  const levelOf = (id: string) => exercises.get(id)?.level;
  const dropoff = lessonDropoff(lessonsRes.data ?? []);
  const hints = hintsByLevel(hintsRes.data ?? [], levelOf);
  const odd = flags(
    (statsRes.data ?? []).map((s) => ({
      exerciseId: s.exercise_id,
      attempts: s.attempts,
      successRate: s.success_rate ?? 0,
      medianTimeMs: null,
    })),
    levelOf,
  );
  const pct = (v: number | null) =>
    v === null ? "–" : format.number(v, { style: "percent", maximumFractionDigits: 0 });
  const n = (v: number) => format.number(v, { maximumFractionDigits: 1 });

  return (
    <div className="grid gap-10">
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

      <section aria-labelledby="dropoff-h" className="grid gap-3" data-learning="dropoff">
        <h2 id="dropoff-h" className="text-xl">
          {t("dropoff.title")}
        </h2>
        <p className="max-w-(--measure) font-sans text-sm text-ink-muted">{t("dropoff.lead")}</p>
        {dropoff.length === 0 ? (
          <p className="font-sans text-sm text-ink-muted">{t("empty")}</p>
        ) : (
          <Table label={t("dropoff.title")}>
            <thead>
              <tr>
                <Th>{t("dropoff.lesson")}</Th>
                <Th>{t("dropoff.started")}</Th>
                <Th>{t("dropoff.completed")}</Th>
                <Th>{t("dropoff.rate")}</Th>
                <Th>{t("dropoff.stalled")}</Th>
              </tr>
            </thead>
            <tbody>
              {dropoff.map((r) => (
                <tr key={r.lesson_id} data-lesson={r.lesson_id}>
                  <Td>{titles[r.lesson_id] ?? r.lesson_id}</Td>
                  <Td>{n(r.started)}</Td>
                  <Td>{n(r.completed)}</Td>
                  <Td>{pct(r.rate)}</Td>
                  <Td>{n(r.stalled)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section aria-labelledby="failures-h" className="grid gap-3" data-learning="failures">
        <h2 id="failures-h" className="text-xl">
          {t("failures.title")}
        </h2>
        <p className="max-w-(--measure) font-sans text-sm text-ink-muted">{t("failures.lead")}</p>
        {odd.length === 0 ? (
          <p className="font-sans text-sm text-ink-muted">{t("failures.none")}</p>
        ) : (
          <Table label={t("failures.title")}>
            <thead>
              <tr>
                <Th>{t("failures.exercise")}</Th>
                <Th>{t("failures.level")}</Th>
                <Th>{t("failures.success")}</Th>
                <Th>{t("failures.verdict")}</Th>
              </tr>
            </thead>
            <tbody>
              {odd.map((f) => (
                <tr key={f.exerciseId} data-exercise={f.exerciseId}>
                  <Td>{f.exerciseId}</Td>
                  <Td>{f.level}</Td>
                  <Td>{pct(f.successRate)}</Td>
                  <Td>{t(`failures.${f.verdict}`)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section aria-labelledby="hints-h" className="grid gap-3" data-learning="hints">
        <h2 id="hints-h" className="text-xl">
          {t("hints.title")}
        </h2>
        <p className="max-w-(--measure) font-sans text-sm text-ink-muted">{t("hints.lead")}</p>
        <Table label={t("hints.title")}>
          <thead>
            <tr>
              <Th>{t("hints.level")}</Th>
              <Th>{t("hints.attempts")}</Th>
              <Th>{t("hints.perAttempt")}</Th>
              <Th>{t("hints.solves")}</Th>
              <Th>{t("hints.hinted")}</Th>
            </tr>
          </thead>
          <tbody>
            {hints.map((h) => (
              <tr key={h.level} data-level={h.level}>
                <Td>{h.level}</Td>
                <Td>{n(h.attempts)}</Td>
                <Td>{n(h.hintsPerAttempt)}</Td>
                <Td>{n(h.solves)}</Td>
                <Td>{pct(h.hintedShare)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
