import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { allExercises, getExercise } from "@/features/exercises/data";
import { ExerciseCard } from "@/features/exercises/exercise-card";
import { publicView } from "@/features/exercises/view";
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

  const { v } = await searchParams;
  const requested = Number(typeof v === "string" ? v : 0);
  const view = publicView(ex, Number.isInteger(requested) ? requested : 0, locale);
  // "Similar exercise": the next variant of this one. The practice hub (8b) adds the next
  // exercise in the current set.
  const nextHref =
    view.variants > 1
      ? `${getPathname({ href: { pathname: "/practice/[exercise]", params: { exercise: id } }, locale })}?v=${String((view.variant + 1) % view.variants)}`
      : null;

  return <ExerciseCard key={`${id}-${String(view.variant)}`} view={view} nextHref={nextHref} />;
}
