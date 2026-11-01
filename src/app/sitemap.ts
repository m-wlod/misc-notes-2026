import type { MetadataRoute } from "next";

import { SECTIONS } from "@/components/shell/section-page";
import { resolveSiteUrl } from "@/config/runtime";
import { env } from "@/env";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppPathname } from "@/i18n/routing";

/**
 * Every public route in both locales, each with its hreflang alternates.
 * Stub: Phase 5 adds lessons and the glossary, Phase 19 adds video landing pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveSiteUrl(env);
  const hrefs: AppPathname[] = ["/", ...Object.values(SECTIONS).map((s) => s.href)];
  const abs = (href: AppPathname, locale: (typeof routing.locales)[number]) =>
    new URL(getPathname({ href, locale }), base).href;

  return hrefs.flatMap((href) =>
    routing.locales.map((locale) => ({
      url: abs(href, locale),
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, abs(href, l)])),
      },
    })),
  );
}
