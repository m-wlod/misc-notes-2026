import type { MetadataRoute } from "next";

import { resolveSiteUrl } from "@/config/runtime";
import { env } from "@/env";
import { routing } from "@/i18n/routing";

export default function robots(): MetadataRoute.Robots {
  const base = resolveSiteUrl(env);
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/pl/styleguide", "/en/styleguide", "/pl/dev/", "/en/dev/"],
    },
    // One sitemap per language (Phase 19b).
    sitemap: routing.locales.map((l) => new URL(`/sitemap/${l}.xml`, base).href),
  };
}
