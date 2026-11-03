import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { alternatesForPaths } from "@/components/shell/section-page";
import { Skeleton } from "@/components/ui/display";
import { lessonHref, lessonNodes } from "@/features/curriculum";
import { ogMeta } from "@/features/seo/og";
import { DEFAULT_SEED, parseState } from "@/features/sims/params";
import { SimPlayer } from "@/features/sims/player";
import { SIMS, simBySlug } from "@/features/sims/registry";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/lab/sims/[id]">;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SIMS.map((s) => ({ locale, id: s.slug[locale] })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, id } = await params;
  const locale = raw as Locale;
  const def = simBySlug(id);
  if (!def) return {};
  const t = await getTranslations({ locale, namespace: "sims" });
  return {
    title: t(`${def.id}.title` as "coin-walk.title"),
    description: t(`${def.id}.short` as "coin-walk.short"),
    alternates: alternatesForPaths(locale, (l) =>
      getPathname({ href: { pathname: "/lab/sims/[id]", params: { id: def.slug[l] } }, locale: l }),
    ),
    ...ogMeta({
      kind: "sim",
      id: def.id,
      locale,
      title: t(`${def.id}.title` as "coin-walk.title"),
      description: t(`${def.id}.short` as "coin-walk.short"),
    }),
  };
}

/** One simulation (Phase 12): the player, its caption and its lesson. */
export default async function SimulationPage({ params, searchParams }: Props) {
  const { locale: raw, id } = await params;
  const locale = raw === "en" ? "en" : "pl";
  const def = simBySlug(id);
  if (!def || def.slug[locale] !== id) notFound();
  const t = await getTranslations("sims");
  const lesson = lessonNodes(locale)[def.lessonId];
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6">
      <p className="mb-2 font-sans text-sm">
        <Link href="/lab">{t("lab.title")}</Link>
      </p>
      <h1 className="mb-3 text-3xl">{t(`${def.id}.title` as "coin-walk.title")}</h1>
      <p className="mb-2 max-w-(--measure) text-base text-ink">
        {t(`${def.id}.short` as "coin-walk.short")}
      </p>
      <p className="mb-6 max-w-(--measure) text-sm text-ink-muted">{t("lab.captionStub")}</p>
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Player id={def.id} searchParams={searchParams} />
      </Suspense>
      {lesson ? (
        <p className="mt-8 font-sans text-sm">
          <Link href={lessonHref(lesson)}>{t("lab.lesson", { title: lesson.title })}</Link>
        </p>
      ) : null}
    </div>
  );
}

/** Request time: the run in the link (params, seed, frame) and recording mode. */
async function Player({ id, searchParams }: { id: string; searchParams: Props["searchParams"] }) {
  const def = SIMS.find((s) => s.id === id);
  if (!def) return null;
  const raw = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") q.set(k, v);
  const state = parseState(def.params, q, DEFAULT_SEED);
  return (
    <SimPlayer key={q.toString()} id={id} initial={state} recording={q.get("nagranie") === "1"} />
  );
}
