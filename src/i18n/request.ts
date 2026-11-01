import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { formats } from "@/lib/i18n/format";

import { loadMessages } from "./messages";
import { routing } from "./routing";

/**
 * Per-request i18n config. The locale comes from the `[locale]` root param
 * (next/root-params), so pages stay statically renderable with Cache Components and
 * no `setRequestLocale` calls are needed.
 */
export default getRequestConfig(async ({ locale: explicit }) => {
  const locale = explicit ?? (await rootParams.locale());
  if (!hasLocale(routing.locales, locale)) notFound();

  return {
    locale,
    messages: await loadMessages(locale),
    formats,
    timeZone: "Europe/Warsaw",
  };
});
