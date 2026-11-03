import "server-only";

import { getTranslations } from "next-intl/server";

import { resolveSiteUrl } from "@/config/runtime";
import { siteConfig } from "@/config/site";
import { env } from "@/env";
import type { Locale } from "@/i18n/routing";

import { organization, type Thing } from "./jsonld";

/** An absolute URL on this site (structured data needs them). */
export const absolute = (path: string) => new URL(path, resolveSiteUrl(env)).href;

/** The site as the publisher of every lesson and course. */
export async function publisher(locale: Locale): Promise<Thing> {
  const t = await getTranslations({ locale, namespace: "seo" });
  return organization(siteConfig.name, absolute("/"), t("publisher"));
}
