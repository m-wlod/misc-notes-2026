import "katex/dist/katex.min.css";

import katex from "katex";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { VideoEmbed } from "@/components/content/video-embed";
import { alternatesForPaths } from "@/components/shell/section-page";
import { Skeleton } from "@/components/ui/display";
import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { TrackVideoView } from "@/features/analytics/track-view";
import { getLesson } from "@/features/content/lessons";
import { lessonHref, lessonNodes } from "@/features/curriculum";
import { listEntries } from "@/features/debunk/entries";
import { getExercise } from "@/features/exercises/data";
import { ExerciseCard } from "@/features/exercises/exercise-card";
import { publicView } from "@/features/exercises/view";
import { JsonLd } from "@/features/seo/json-ld";
import { plainText, quiz } from "@/features/seo/jsonld";
import { ogMeta } from "@/features/seo/og";
import { absolute } from "@/features/seo/site";
import { Simulation } from "@/features/sims/embed";
import { simById } from "@/features/sims/registry";
import { allVideoSlugs, pickText, videoBySlug, videoUrl } from "@/features/videos/entries";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/v/[slug]">;

export function generateStaticParams() {
  return allVideoSlugs();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  const v = videoBySlug(slug, true);
  if (!v) return {};
  const t = await getTranslations({ locale, namespace: "videos" });
  return {
    title: pickText(v.title, locale),
    description: t("description", { title: pickText(v.title, locale) }),
    alternates: alternatesForPaths(locale, (l) =>
      getPathname({ href: { pathname: "/v/[slug]", params: { slug } }, locale: l }),
    ),
    ...(v.status === "published" ? {} : { robots: { index: false, follow: true } }),
    ...ogMeta({
      kind: "video",
      id: v.id,
      locale,
      title: pickText(v.title, locale),
      description: t("description", { title: pickText(v.title, locale) }),
      type: "article",
    }),
  };
}

/**
 * A video's landing page (Phase 19): the link in bio and pinned comments point here.
 * The clip (click to load), its key formula, the matching simulation, three exercises
 * playable without an account, and the lesson to read next. One content file each.
 */
export default async function VideoPage({ params }: Props) {
  // An unknown slug is a real 404; an unpublished one is decided per deployment below.
  const { slug } = await params;
  if (!allVideoSlugs().some((v) => v.slug === slug)) notFound();
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-12 h-96 max-w-4xl" />}>
      <VideoLanding params={params} />
    </Suspense>
  );
}

async function VideoLanding({ params }: Pick<Props, "params">) {
  await connection();
  const { locale: raw, slug } = await params;
  const locale = (routing.locales as readonly string[]).includes(raw) ? (raw as Locale) : "pl";
  const internal = isStyleguideEnabled(env);
  const v = videoBySlug(slug, internal);
  if (!v) notFound();
  const t = await getTranslations("videos");
  const title = pickText(v.title, locale);
  const url = videoUrl(v);
  const sim = simById(v.simulation);
  const exercises = v.exercises.flatMap((id) => {
    const ex = getExercise(id, internal);
    return ex ? [publicView(ex, 0, locale)] : [];
  });
  const node = lessonNodes(locale)[v.nextLesson];
  const lesson = getLesson(v.nextLesson, locale, { includeDrafts: internal });
  const debunkId = v.debunk;
  const entry = debunkId
    ? (listEntries(locale, internal).find((e) => e.id === debunkId) ?? null)
    : null;
  const structured = quiz({
    name: title,
    url: absolute(
      getPathname({ href: { pathname: "/v/[slug]", params: { slug: v.slug } }, locale }),
    ),
    locale,
    questions: exercises.map((e) => plainText(e.promptHtml)),
  });
  const formula = katex.renderToString(v.formula, {
    displayMode: true,
    output: "htmlAndMathml",
    throwOnError: false,
  });

  return (
    <article data-video={v.id} className="mx-auto grid max-w-4xl gap-10 px-4 pt-10 pb-16 sm:px-6">
      <TrackVideoView slug={v.slug} />
      <JsonLd data={structured} />
      <header className="grid gap-3">
        {v.sample ? (
          <p className="font-sans text-xs tracking-wide text-ink-muted uppercase">{t("sample")}</p>
        ) : null}
        <h1 className="text-3xl">{title}</h1>
      </header>

      {url ? (
        <section aria-labelledby="clip-title" className="grid gap-3">
          <h2 id="clip-title" className="sr-only">
            {t("clip")}
          </h2>
          <VideoEmbed url={url} title={title} />
        </section>
      ) : null}

      <section aria-labelledby="formula-title" className="grid gap-3" data-formula>
        <h2 id="formula-title" className="text-xl">
          {t("formula")}
        </h2>
        <div
          className="overflow-x-auto rounded-md border border-rule px-4 py-3"
          dangerouslySetInnerHTML={{ __html: formula }}
        />
        <p className="max-w-(--measure) text-ink-muted">{pickText(v.formulaCaption, locale)}</p>
      </section>

      {sim ? (
        <section aria-labelledby="sim-title" className="grid gap-3" data-video-sim={sim.id}>
          <h2 id="sim-title" className="text-xl">
            {t("simulation")}
          </h2>
          <Simulation id={sim.id} />
        </section>
      ) : null}

      {exercises.length > 0 ? (
        <section aria-labelledby="exercises-title" className="grid gap-4">
          <h2 id="exercises-title" className="text-xl">
            {t("exercises")}
          </h2>
          <p className="text-ink-muted">{t("exercisesNote")}</p>
          <ol className="grid gap-6">
            {exercises.map((view) => (
              <li key={view.id} data-video-exercise={view.id}>
                <ExerciseCard view={view} similarHref={null} nextHref={null} embedded />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {node || entry ? (
        <section aria-labelledby="next-title" className="grid gap-3 border-t border-rule pt-6">
          <h2 id="next-title" className="text-xl">
            {t("next")}
          </h2>
          <ul className="grid gap-3">
            {node ? (
              <li data-next-lesson={v.nextLesson}>
                <Link href={lessonHref(node)} className="font-medium">
                  {t("lesson", { title: lesson?.lesson.title ?? node.title })}
                </Link>
                <p className="text-sm text-ink-muted">{node.summary}</p>
              </li>
            ) : null}
            {entry ? (
              <li data-video-debunk={entry.id}>
                <Link
                  href={{ pathname: "/debunk/[slug]", params: { slug: entry.slug } }}
                  className="font-medium"
                >
                  {t("debunk", { claim: entry.claim })}
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
