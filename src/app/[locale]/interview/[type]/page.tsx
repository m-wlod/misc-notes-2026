import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { alternatesForPaths } from "@/components/shell/section-page";
import { Skeleton } from "@/components/ui/display";
import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { aiAvailable } from "@/features/ai-grading/service";
import { listExercises } from "@/features/exercises/data";
import { publicView } from "@/features/exercises/view";
import { ExercisePlayer } from "@/features/interview/exercise-player";
import { KINDS, kindBySlug } from "@/features/interview/kinds";
import { MarketMakingPlayer } from "@/features/interview/market-making-player";
import { MentalMathPlayer } from "@/features/interview/mental-math-player";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/interview/[type]">;

/** Each type in each language (the slugs differ per language). */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    KINDS.filter((k) => k.playable).map((k) => ({ locale, type: k.slug[locale] })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, type } = await params;
  const locale = raw as Locale;
  const info = kindBySlug(type);
  if (!info) return {};
  const t = await getTranslations({ locale, namespace: "interview" });
  return {
    title: t(`kinds.${info.kind}.title`),
    description: t(`kinds.${info.kind}.description`),
    alternates: alternatesForPaths(locale, (l) =>
      getPathname({
        href: { pathname: "/interview/[type]", params: { type: info.slug[l] } },
        locale: l,
      }),
    ),
  };
}

/** One session type: setup → timed session → scorecard → review. */
export default async function InterviewSessionPage({ params }: Props) {
  const { locale: raw, type } = await params;
  const locale = raw === "en" ? "en" : "pl";
  const info = kindBySlug(type);
  if (!info?.playable || info.slug[locale] !== type) notFound();
  const t = await getTranslations("interview");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6">
      <p className="mb-2 font-sans text-sm">
        <Link href="/interview">{t("hub.title")}</Link>
      </p>
      <h1 className="mb-6 text-3xl">{t(`kinds.${info.kind}.title`)}</h1>
      {info.kind === "mental_math" ? (
        <MentalMathPlayer />
      ) : info.kind === "market_making" ? (
        <MarketMakingPlayer />
      ) : (
        <Suspense fallback={<Skeleton className="h-64 max-w-(--measure)" />}>
          <PoolSession kind={info.kind} locale={locale} />
        </Suspense>
      )}
    </div>
  );
}

const TAG = {
  probability_sprint: "sprint",
  brainteasers: "brainteasers",
  open_modelling: "modelling",
} as const;

/**
 * Request time: the exercises tagged for this session (samples only on internal
 * deployments), as public views. Answers, hints and solutions stay on the server.
 */
async function PoolSession({ kind, locale }: { kind: keyof typeof TAG; locale: "pl" | "en" }) {
  await connection();
  const pool = listExercises(isStyleguideEnabled(env))
    .filter((e) => e.interview.includes(TAG[kind]))
    .map((e) => publicView(e, 0, locale));
  return <ExercisePlayer kind={kind} pool={pool} aiAvailable={aiAvailable()} />;
}
