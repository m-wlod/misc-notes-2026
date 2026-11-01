import type { Metadata } from "next";

/**
 * canonical + hreflang alternates for one page. `pathFor(locale)` returns the
 * locale-prefixed public path (e.g. from next-intl's getPathname), so this stays a pure
 * function. `x-default` points at the default locale.
 */
export function localeAlternates<L extends string>({
  locale,
  locales,
  defaultLocale,
  pathFor,
  base,
}: {
  locale: L;
  locales: readonly L[];
  defaultLocale: L;
  pathFor: (locale: L) => string;
  base: URL;
}): NonNullable<Metadata["alternates"]> {
  const abs = (l: L) => new URL(pathFor(l), base).href;
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = abs(l);
  languages["x-default"] = abs(defaultLocale);
  return { canonical: abs(locale), languages };
}
