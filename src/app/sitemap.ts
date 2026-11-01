import type { MetadataRoute } from "next";

import { SECTIONS } from "@/components/shell/section-page";
import { resolveSiteUrl } from "@/config/runtime";
import { env } from "@/env";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale, type StaticPathname } from "@/i18n/routing";

import { curriculum } from "../../content/curriculum";

/**
 * Every public route in both locales, each with its hreflang alternates: the sections,
 * the textbook, and every track and module page (slugs differ per locale).
 * Lesson pages join in Phase 6, video landing pages in Phase 19.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveSiteUrl(env);
  const hrefs: StaticPathname[] = ["/", ...Object.values(SECTIONS).map((s) => s.href), "/textbook"];
  type Href = Parameters<typeof getPathname>[0]["href"];
  const abs = (href: Href, locale: Locale) => new URL(getPathname({ href, locale }), base).href;
  const entry = (hrefFor: (locale: Locale) => Href) =>
    routing.locales.map((locale) => ({
      url: abs(hrefFor(locale), locale),
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, abs(hrefFor(l), l)])),
      },
    }));

  return [
    ...hrefs.flatMap((href) => entry(() => href)),
    ...curriculum.flatMap((track) => [
      ...entry((l) => ({ pathname: "/learn/[track]", params: { track: track.slug[l] } })),
      ...track.modules.flatMap((mod) =>
        entry((l) => ({
          pathname: "/learn/[track]/[module]",
          params: { track: track.slug[l], module: mod.slug[l] },
        })),
      ),
    ]),
  ];
}
