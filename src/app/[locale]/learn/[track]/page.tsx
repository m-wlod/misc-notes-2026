import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { alternatesForPaths } from "@/components/shell/section-page";
import { findTrack, getCurriculum, lessonHref, titlesFor, trackSlugs } from "@/features/curriculum";
import { LessonPath } from "@/features/curriculum/lesson-path";
import { ModuleProgress } from "@/features/curriculum/module-progress";
import { UnitMeta } from "@/features/curriculum/views";
import { JsonLd } from "@/features/seo/json-ld";
import { course } from "@/features/seo/jsonld";
import { ogMeta } from "@/features/seo/og";
import { absolute, publisher } from "@/features/seo/site";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/learn/[track]">;

const trackHref = (track: string) => ({ pathname: "/learn/[track]", params: { track } }) as const;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  return getCurriculum(params.locale as Locale).map((t) => ({ track: t.slug }));
}

/** The track in this locale. Slugs from the other locale are redirected earlier, in proxy.ts. */
async function resolve(params: Props["params"]) {
  const { locale: raw, track: slug } = await params;
  const locale = raw as Locale;
  const track = findTrack(locale, slug);
  if (track) return { locale, track };
  notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, track } = await resolve(params);
  const slugs = trackSlugs(track.id);
  return {
    title: track.name,
    description: track.description,
    alternates: alternatesForPaths(locale, (l) =>
      getPathname({ href: trackHref(slugs?.[l] ?? track.slug), locale: l }),
    ),
    ...ogMeta({
      kind: "track",
      id: track.id,
      locale,
      title: track.name,
      description: track.description,
    }),
  };
}

export default async function TrackPage({ params }: Props) {
  const { locale, track } = await resolve(params);
  const t = await getTranslations("curriculum");
  const structured = course({
    name: track.name,
    description: track.description,
    url: absolute(getPathname({ href: trackHref(track.slug), locale })),
    locale,
    provider: await publisher(locale),
    lessons: track.modules.flatMap((m) =>
      m.lessons.map((l) => ({
        name: l.title,
        url: absolute(getPathname({ href: lessonHref(l), locale })),
      })),
    ),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <JsonLd data={structured} />
      <p className="mb-6 font-sans text-sm">
        <Link href="/learn" className="text-accent-text underline underline-offset-2">
          ← {t("allTracks")}
        </Link>
      </p>
      <p className="num text-xs text-ink-muted">{t("track", { number: track.number })}</p>
      <h1 className="mb-3 text-3xl">{track.name}</h1>
      <p className="mb-3 max-w-(--measure) text-base text-ink-muted">{track.description}</p>
      <UnitMeta unit={track} />
      <ModuleProgress lessonIds={track.modules.flatMap((m) => m.lessons.map((l) => l.id))} />

      <div className="mt-10 grid max-w-(--measure) gap-10">
        {track.modules.map((mod) => (
          <section key={mod.id} aria-labelledby={`module-${mod.id}`}>
            <p className="num text-xs text-ink-muted">{t("module", { number: mod.number })}</p>
            <h2 id={`module-${mod.id}`} className="mb-2 text-xl">
              <Link
                href={{
                  pathname: "/learn/[track]/[module]",
                  params: { track: track.slug, module: mod.slug },
                }}
                className="underline-offset-4 hover:underline"
              >
                {mod.name}
              </Link>
            </h2>
            <UnitMeta unit={mod} />
            <div className="mt-5">
              <LessonPath lessons={mod.lessons} titles={titlesFor(locale, mod.lessons)} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
