import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { alternatesFor, SECTIONS } from "@/components/shell/section-page";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/display";
import { LANDING } from "@/config/landing";
import { isStyleguideEnabled } from "@/config/runtime";
import { siteConfig } from "@/config/site";
import { env } from "@/env";
import { getExercise, listExercises } from "@/features/exercises/data";
import { ExerciseCard } from "@/features/exercises/exercise-card";
import { publicView } from "@/features/exercises/view";
import { TodaySection } from "@/features/gamification/ui/today-section";
import { JsonLd } from "@/features/seo/json-ld";
import { website } from "@/features/seo/jsonld";
import { ogMeta } from "@/features/seo/og";
import { absolute } from "@/features/seo/site";
import { Simulation } from "@/features/sims/embed";
import { listVideos, pickText } from "@/features/videos/entries";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    title: { absolute: t("metaTitle") },
    description: t("lead"),
    alternates: alternatesFor("/", locale),
    ...ogMeta({ kind: "page", id: "home", locale, title: t("metaTitle"), description: t("lead") }),
  };
}

const ROADMAP = ["learn", "practice", "interview", "debunk", "lab"] as const;

/**
 * The landing page (Phase 19): one promise, a live simulation instead of a hero image,
 * a one-minute exercise anyone can solve without an account, the latest videos, and an
 * honest note on why it's free. No testimonials, no counters, no fake social proof.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = (await params).locale as Locale;
  const t = await getTranslations("home");
  const tAll = await getTranslations();
  const structured = website({
    name: siteConfig.name,
    url: absolute(getPathname({ href: "/", locale })),
    locale,
    description: t("lead"),
  });
  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-4 pt-16 pb-16 sm:px-6">
      <JsonLd data={structured} />
      <header className="grid gap-5">
        <h1 className="max-w-3xl text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="max-w-(--measure) font-serif text-reading">{t("lead")}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/learn" className={buttonClass("primary")}>
            {t("ctaLearn")}
          </Link>
        </div>
        <p className="max-w-(--measure) border-l-2 border-rule-strong pl-5 text-base text-ink-muted">
          {t("status")}
        </p>
      </header>

      <section aria-labelledby="landing-sim" className="grid gap-3" data-landing-sim>
        <h2 id="landing-sim" className="text-xl">
          {t("simTitle")}
        </h2>
        <p className="max-w-(--measure) text-ink-muted">{t("simNote")}</p>
        <Simulation id={LANDING.simulation} />
      </section>

      <Suspense fallback={<Skeleton className="h-64" />}>
        <TryAndWatch locale={locale} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-40" />}>
        <TodaySection />
      </Suspense>

      <section aria-labelledby="landing-about" className="grid gap-3">
        <h2 id="landing-about" className="text-xl">
          {t("aboutTitle")}
        </h2>
        <p className="max-w-(--measure) font-serif text-reading">{t("aboutBody")}</p>
        <p>
          <Link href="/about">{t("aboutMore")}</Link>
        </p>
      </section>

      <section aria-labelledby="landing-sections">
        <h2 id="landing-sections" className="mb-6 border-b border-rule pb-2 text-xl">
          {t("sectionsHeading")}
        </h2>
        <ol className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {ROADMAP.map((key) => (
            <li key={key} className="grid grid-cols-[3rem_1fr] gap-x-3">
              <span className="pt-0.5 num text-xs text-ink-muted">
                {String(SECTIONS[key].phase).padStart(2, "0")}
              </span>
              <div>
                <Link
                  href={SECTIONS[key].href}
                  className="font-medium text-ink underline-offset-4 hover:underline"
                >
                  {tAll(`sections.${key}.title`)}
                </Link>
                <p className="mt-1 text-sm text-ink-muted">{tAll(`sections.${key}.description`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** The sample exercise and the latest videos: what's visible depends on the deployment. */
async function TryAndWatch({ locale }: { locale: Locale }) {
  await connection();
  const internal = isStyleguideEnabled(env);
  const t = await getTranslations("home");
  const featured =
    (LANDING.exercise ? getExercise(LANDING.exercise, internal) : undefined) ??
    listExercises(internal).find((e) => e.level === 1 && e.type !== "code");
  const videos = listVideos(internal).slice(0, LANDING.videos);
  if (!featured && videos.length === 0) return null;
  return (
    <>
      {featured ? (
        <section id="zadanie" aria-labelledby="landing-try" className="grid scroll-mt-20 gap-3">
          <h2 id="landing-try" className="text-xl">
            {t("tryTitle")}
          </h2>
          <p className="text-ink-muted">{t("tryNote")}</p>
          <div data-landing-exercise={featured.id}>
            <ExerciseCard
              view={publicView(featured, 0, locale)}
              similarHref={null}
              embedded
              nextHref={null}
            />
          </div>
        </section>
      ) : null}
      {videos.length > 0 ? (
        <section aria-labelledby="landing-videos" className="grid gap-3">
          <h2 id="landing-videos" className="text-xl">
            {t("videosTitle")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {videos.map((v) => (
              <li key={v.id} data-landing-video={v.slug}>
                <Link
                  href={{ pathname: "/v/[slug]", params: { slug: v.slug } }}
                  className="block h-full rounded-md border border-rule px-4 py-3 no-underline hover:border-rule-strong"
                >
                  <span className="font-medium text-ink">{pickText(v.title, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
