import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { resolveSiteUrl } from "@/config/runtime";
import { env } from "@/env";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppPathname, type Locale } from "@/i18n/routing";
import { localeAlternates } from "@/lib/i18n/seo";

/** Placeholder sections and the build phase each one arrives in (docs/BUILD_PLAN.md). */
export const SECTIONS = {
  learn: { href: "/learn", phase: 5 },
  practice: { href: "/practice", phase: 8 },
  interview: { href: "/interview", phase: 11 },
  debunk: { href: "/debunk", phase: 16 },
  glossary: { href: "/glossary", phase: 4 },
  lab: { href: "/lab", phase: 12 },
  about: { href: "/about", phase: 19 },
  privacy: { href: "/privacy", phase: 21 },
  terms: { href: "/terms", phase: 21 },
  cookies: { href: "/cookies", phase: 21 },
  disclaimer: { href: "/disclaimer", phase: 21 },
} as const satisfies Record<string, { href: AppPathname; phase: number }>;

export type SectionKey = keyof typeof SECTIONS;

/** canonical + hreflang for any route, from the routing table. */
export function alternatesFor(href: AppPathname, locale: Locale) {
  return localeAlternates({
    locale,
    locales: routing.locales,
    defaultLocale: routing.defaultLocale,
    pathFor: (l) => getPathname({ href, locale: l }),
    base: resolveSiteUrl(env),
  });
}

/**
 * Builds a placeholder page for a top-level section: a real h1, one honest sentence
 * about what will be there, and the phase it arrives in. No fake content.
 */
export function sectionPage(key: SectionKey) {
  const { href, phase } = SECTIONS[key];

  async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const locale = (await params).locale as Locale;
    const t = await getTranslations({ locale, namespace: "sections" });
    return {
      title: t(`${key}.title`),
      description: t(`${key}.description`),
      alternates: alternatesFor(href, locale),
    };
  }

  async function Page() {
    const t = await getTranslations("sections");
    const c = await getTranslations("common");
    return (
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
        <h1 className="mb-4 max-w-(--measure) text-3xl">{t(`${key}.title`)}</h1>
        <p className="mb-8 max-w-(--measure) font-serif text-reading text-ink">
          {t(`${key}.description`)}
        </p>
        <div className="max-w-(--measure) border-l-2 border-rule-strong py-1 pl-5" role="note">
          <p className="mb-2 text-base text-ink">{t(`${key}.body`)}</p>
          <p className="num text-xs text-ink-muted">{c("comingSoon", { phase })}</p>
        </div>
      </div>
    );
  }

  return { Page, generateMetadata };
}
