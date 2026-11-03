import type { MetadataRoute } from "next";

import { SECTIONS } from "@/components/shell/section-page";
import { resolveSiteUrl } from "@/config/runtime";
import { env } from "@/env";
import { getLesson } from "@/features/content/lessons";
import { lessonHref, lessonsInOrder } from "@/features/curriculum";
import { listEntries, slugsOf } from "@/features/debunk/entries";
import { SIMS } from "@/features/sims/registry";
import { listVideos } from "@/features/videos/entries";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale, type StaticPathname } from "@/i18n/routing";

import { curriculum } from "../../content/curriculum";

/**
 * One sitemap per locale (Phase 19b): /sitemap/pl.xml and /sitemap/en.xml, both listed
 * in robots.txt. Every entry carries its hreflang alternates. Only what search engines
 * may index: published, non-stub lessons and published debunk entries and videos;
 * drafts and samples never appear.
 */
export function generateSitemaps() {
  return routing.locales.map((id) => ({ id }));
}

type Href = Parameters<typeof getPathname>[0]["href"];

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const locale: Locale = (routing.locales as readonly string[]).includes(id)
    ? (id as Locale)
    : routing.defaultLocale;
  const base = resolveSiteUrl(env);
  const abs = (href: Href, l: Locale) => new URL(getPathname({ href, locale: l }), base).href;
  const entry = (hrefFor: (l: Locale) => Href) => ({
    url: abs(hrefFor(locale), locale),
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, abs(hrefFor(l), l)])),
    },
  });

  const statics: StaticPathname[] = [
    "/",
    ...Object.values(SECTIONS).map((s) => s.href),
    "/textbook",
    "/map",
  ];
  const lessonPlaces = (l: Locale) => new Map(lessonsInOrder(l).map((p) => [p.lesson.id, p]));
  const places = Object.fromEntries(routing.locales.map((l) => [l, lessonPlaces(l)])) as Record<
    Locale,
    ReturnType<typeof lessonPlaces>
  >;
  const indexableLessons = [...places[locale].values()].filter(
    (p) => !p.lesson.isStub && getLesson(p.lesson.id, locale)?.lesson.status === "published",
  );

  return [
    ...statics.map((href) => entry(() => href)),
    ...curriculum.flatMap((track) => [
      entry((l) => ({ pathname: "/learn/[track]", params: { track: track.slug[l] } })),
      ...track.modules.map((mod) =>
        entry((l) => ({
          pathname: "/learn/[track]/[module]",
          params: { track: track.slug[l], module: mod.slug[l] },
        })),
      ),
    ]),
    ...indexableLessons.map((p) =>
      entry((l) => lessonHref((places[l].get(p.lesson.id) ?? p).lesson)),
    ),
    ...listEntries(locale, false).map((e) => {
      const slugs = slugsOf(e.id);
      return entry((l) => ({
        pathname: "/debunk/[slug]",
        params: { slug: slugs[l] ?? slugs.pl ?? e.slug },
      }));
    }),
    ...SIMS.map((s) => entry((l) => ({ pathname: "/lab/sims/[id]", params: { id: s.slug[l] } }))),
    ...listVideos(false).map((v) =>
      entry(() => ({ pathname: "/v/[slug]", params: { slug: v.slug } })),
    ),
  ];
}
