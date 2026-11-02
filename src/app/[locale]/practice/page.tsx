import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { alternatesFor } from "@/components/shell/section-page";
import { Skeleton } from "@/components/ui/display";
import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { getCurriculum } from "@/features/curriculum";
import { listExercises } from "@/features/exercises/data";
import { toQuery, parseFilters, type Filters } from "@/features/exercises/filter";
import { FiltersForm, PracticeList, type ListItem } from "@/features/exercises/practice-list";
import { lessonTitle, practiceSet } from "@/features/exercises/practice-set";
import { publicView } from "@/features/exercises/view";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/practice">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "exercises.hub" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: alternatesFor("/practice", locale),
  };
}

export default async function PracticePage({
  params,
  searchParams,
}: PageProps<"/[locale]/practice">) {
  const t = await getTranslations("exercises.hub");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-3 text-3xl">{t("title")}</h1>
      <p className="mb-8 max-w-(--measure) text-base text-ink-muted">{t("lead")}</p>
      <Suspense fallback={<Skeleton className="h-64 max-w-(--measure)" />}>
        <Hub params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** Request time: filters come from the URL; samples and drafts only on internal deployments. */
async function Hub({
  params,
  searchParams,
}: Pick<PageProps<"/[locale]/practice">, "params" | "searchParams">) {
  await connection();
  const locale = (await params).locale === "en" ? "en" : "pl";
  const t = await getTranslations("exercises");
  const levelNames = await getTranslations("onboarding.levels");
  const internal = isStyleguideEnabled(env);
  const filters = parseFilters(await searchParams);
  const base = getPathname({ href: "/practice", locale });

  const available = listExercises(internal);
  if (available.length === 0)
    return <p className="max-w-(--measure) text-base">{t("hub.empty")}</p>;

  const set = practiceSet(filters, internal);
  const query = toQuery(filters);
  const items: ListItem[] = set.map((ex) => {
    const view = publicView(ex, 0, locale);
    return {
      id: ex.id,
      href: `${getPathname({ href: { pathname: "/practice/[exercise]", params: { exercise: ex.id } }, locale })}${query}`,
      promptHtml: view.promptHtml,
      level: ex.level,
      typeLabel: t(`types.${ex.type}`),
      minutes: ex.estimatedMinutes,
      sample: ex.sample,
    };
  });

  const withLevel = (level: number | undefined): string => {
    const next: Filters = { ...filters };
    if (level === undefined) delete next.level;
    else next.level = level;
    return `${base}${toQuery(next)}`;
  };
  const tracks = getCurriculum(locale);
  const topics = [...new Set(available.flatMap((e) => e.topics))].sort();
  const types = [...new Set(available.map((e) => e.type))];
  const lesson = filters.lesson ? (lessonTitle(locale, filters.lesson) ?? filters.lesson) : null;

  return (
    <div className="grid gap-8">
      <nav aria-label={t("hub.levels")}>
        <ol className="flex flex-wrap gap-2 font-sans text-sm">
          {[undefined, 1, 2, 3, 4, 5].map((level) => {
            const active = filters.level === level;
            return (
              <li key={level ?? "all"}>
                <a
                  href={withLevel(level)}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex items-center gap-2 rounded border px-3 py-1.5",
                    active
                      ? "border-ink bg-ink text-bg"
                      : "border-rule-strong text-ink-muted hover:text-ink",
                  )}
                >
                  {level === undefined ? (
                    t("hub.allLevels")
                  ) : (
                    <>
                      <span className="num">{level}</span>
                      {levelNames(`${String(level) as "1"}.name`)}
                    </>
                  )}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      <FiltersForm action={base}>
        {filters.level !== undefined ? (
          <input type="hidden" name="level" value={filters.level} />
        ) : null}
        {filters.lesson ? <input type="hidden" name="lesson" value={filters.lesson} /> : null}
        <div className="grid gap-1">
          <label htmlFor="filter-track" className="text-xs text-ink-muted">
            {t("hub.track")}
          </label>
          <select
            id="filter-track"
            name="track"
            defaultValue={filters.track ?? ""}
            className="rounded border border-rule-strong bg-surface px-2 py-1.5 text-ink"
          >
            <option value="">{t("hub.allTracks")}</option>
            {tracks.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {`${String(tr.number)}. ${tr.name}`}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="filter-topic" className="text-xs text-ink-muted">
            {t("hub.topic")}
          </label>
          <select
            id="filter-topic"
            name="topic"
            defaultValue={filters.topic ?? ""}
            className="rounded border border-rule-strong bg-surface px-2 py-1.5 text-ink"
          >
            <option value="">{t("hub.allTopics")}</option>
            {topics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="filter-type" className="text-xs text-ink-muted">
            {t("hub.type")}
          </label>
          <select
            id="filter-type"
            name="type"
            defaultValue={filters.type ?? ""}
            className="rounded border border-rule-strong bg-surface px-2 py-1.5 text-ink"
          >
            <option value="">{t("hub.allTypes")}</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded border border-rule-strong px-3 py-1.5 text-ink hover:bg-sunken"
        >
          {t("hub.filter")}
        </button>
        {query ? (
          <Link href="/practice" className="py-1.5 text-accent-text underline underline-offset-2">
            {t("hub.clear")}
          </Link>
        ) : null}
      </FiltersForm>

      {lesson ? (
        <p className="max-w-(--measure) font-sans text-sm text-ink">
          {t("hub.lesson", { title: lesson })}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="max-w-(--measure) text-base">{t("hub.noMatch")}</p>
      ) : (
        <div className="max-w-(--measure)">
          <PracticeList items={items} sampleLabel={t("sample")} />
        </div>
      )}
    </div>
  );
}
