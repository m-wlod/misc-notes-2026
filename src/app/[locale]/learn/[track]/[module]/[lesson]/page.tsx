import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { alternatesForPaths } from "@/components/shell/section-page";
import { Discussion } from "@/features/community/discussion";
import { getLesson } from "@/features/content/lessons";
import {
  findLesson,
  lessonHref,
  lessonNodes,
  lessonsInOrder,
  neighbours,
} from "@/features/curriculum";
import { exerciseCount } from "@/features/exercises/practice-set";
import { Reader } from "@/features/reader/reader";
import { JsonLd } from "@/features/seo/json-ld";
import { learningResource } from "@/features/seo/jsonld";
import { ogMeta } from "@/features/seo/og";
import { RelatedLinks } from "@/features/seo/related-links";
import { absolute, publisher } from "@/features/seo/site";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/learn/[track]/[module]/[lesson]">;

/**
 * Every lesson for the locale. The parent [track]/[module] segments have no layout, so
 * this route only receives the locale and generates the whole path itself.
 */
export function generateStaticParams({ params }: { params: { locale: string } }) {
  return lessonsInOrder(params.locale as Locale).map(({ track, module, lesson }) => ({
    track: track.slug,
    module: module.slug,
    lesson: lesson.slug,
  }));
}

/** Slugs from the other locale are redirected earlier, in proxy.ts. */
async function resolve(params: Props["params"]) {
  const { locale: raw, track, module, lesson } = await params;
  const locale = raw as Locale;
  const place = findLesson(locale, track, module, lesson);
  const resolved = place ? getLesson(place.lesson.id, locale, { includeDrafts: true }) : null;
  if (!place || !resolved) notFound();
  return { locale, place, resolved };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, place, resolved } = await resolve(params);
  const { lesson } = resolved;
  const byLocale = Object.fromEntries(
    routing.locales.map((l) => [l, lessonNodes(l)[lesson.id]]),
  ) as Record<Locale, (typeof place)["lesson"] | undefined>;
  // Stubs and unreviewed lessons stay out of search engines until they have content.
  const indexable = lesson.status === "published" && !lesson.isStub;
  return {
    title: `${lesson.title} · ${place.track.name}`,
    description: lesson.summary,
    robots: indexable ? undefined : { index: false, follow: true },
    alternates: alternatesForPaths(locale, (l) =>
      getPathname({ href: lessonHref(byLocale[l] ?? place.lesson), locale: l }),
    ),
    ...ogMeta({
      kind: "lesson",
      id: lesson.id,
      locale,
      title: lesson.title,
      description: lesson.summary,
      type: "article",
    }),
  };
}

export default async function LessonPage({ params }: Props) {
  const { locale, place, resolved } = await resolve(params);
  const nodes = lessonNodes(locale);
  const { lesson } = resolved;
  const structured = learningResource({
    name: lesson.title,
    description: lesson.summary,
    url: absolute(getPathname({ href: lessonHref(place.lesson), locale })),
    locale,
    level: lesson.level,
    minutes: lesson.estimatedMinutes,
    course: {
      name: place.track.name,
      url: absolute(
        getPathname({
          href: { pathname: "/learn/[track]", params: { track: place.track.slug } },
          locale,
        }),
      ),
    },
    provider: await publisher(locale),
  });
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-6">
      <JsonLd data={structured} />
      <Reader
        {...resolved}
        place={place}
        neighbours={neighbours(locale, place.lesson.id)}
        prerequisiteTitles={nodes}
        practiceCount={exerciseCount(place.lesson.id, false)}
      />
      <Suspense fallback={null}>
        <RelatedLinks lessonId={place.lesson.id} locale={locale} />
      </Suspense>
      <Discussion target="lesson" id={place.lesson.id} />
    </div>
  );
}
