import type { MetadataRoute } from "next";

import { resolveSiteUrl } from "@/config/runtime";
import { env } from "@/env";

export default function robots(): MetadataRoute.Robots {
  const base = resolveSiteUrl(env);
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/pl/styleguide", "/en/styleguide", "/pl/dev/", "/en/dev/"],
    },
    sitemap: new URL("/sitemap.xml", base).href,
  };
}
