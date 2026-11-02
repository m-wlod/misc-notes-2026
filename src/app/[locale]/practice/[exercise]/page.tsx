import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { allExercises, getExercise } from "@/features/exercises/data";
import { ExerciseCard } from "@/features/exercises/exercise-card";
import { nextInSet, parseFilters, toQuery } from "@/features/exercises/filter";
import { practiceSet } from "@/features/exercises/practice-set";
import { publicView } from "@/features/exercises/view";
import { LEARNER_COOKIE, seedFor } from "@/features/grading/random";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/practice/[exercise]">;

/**
 * Every exercise id, so the page shell (layout, navigation) prerenders. Visibility is
 * still decided per request below: listing an id here publishes nothing.
 */
export function generateStaticParams() {
  return allExercises().map((e) => ({ exercise: e.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "exercises" });
  // Exercise pages stay out of search engines until published content exists (Phase 9+).
  return { title: t("exercise"), robots: { index: false, follow: true } };
}

export default function ExercisePage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6">
      <Suspense fallback={<Skeleton className="h-80 max-w-(--measure)" />}>
        <Exercise params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/**
 * Request time: samples and drafts are visible only where internal pages are (dev,
 * previews, ENABLE_STYLEGUIDE); published exercises everywhere.
 */
async function Exercise({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  await connection();
  const { locale: raw, exercise: id } = await params;
  const locale = raw === "en" ? "en" : "pl";
  const ex = getExercise(id, isStyleguideEnabled(env));
  if (!ex) notFound();

  const search = await searchParams;
  const one = (k: string) => {
    const raw = search[k];
    const n = Number(Array.isArray(raw) ? raw[0] : (raw ?? 0));
    return Number.isSafeInteger(n) && n >= 0 ? n : 0;
  };
  const filters = parseFilters(search);
  const query = toQuery(filters);
  const pageOf = (exercise: string) =>
    getPathname({ href: { pathname: "/practice/[exercise]", params: { exercise } }, locale });

  // Random params (Phase 9): attempt n of this learner gets its own seed; "Podobne
  // zadanie" is n + 1. Hand-written variants keep ?v=. The server re-derives everything
  // from the seed when grading, so a forged one only picks another valid version.
  const random = "random" in ex && ex.random !== undefined;
  let view;
  let similarHref: string | null;
  if (random) {
    const n = one("n");
    const learner = (await cookies()).get(LEARNER_COOKIE)?.value ?? "anon";
    view = publicView(ex, seedFor(learner, id, n), locale);
    similarHref = `${pageOf(id)}${toQuery(filters, { n: String(n + 1) })}`;
  } else {
    view = publicView(ex, one("v"), locale);
    // "Podobne zadanie": the next variant of this exercise.
    similarHref =
      view.variants > 1
        ? `${pageOf(id)}${toQuery(filters, { v: String((view.variant + 1) % view.variants) })}`
        : null;
  }
  // "Następne zadanie" (N): the next exercise in the set the learner came from.
  const next = nextInSet(practiceSet(filters, isStyleguideEnabled(env)), id);
  const nextHref = next ? `${pageOf(next.id)}${query}` : null;

  return (
    <ExerciseCard
      key={`${id}-${String(view.variant)}`}
      view={view}
      similarHref={similarHref}
      nextHref={nextHref}
    />
  );
}
