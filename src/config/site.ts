/**
 * Brand constants. The product name is a placeholder until it's chosen; change it
 * here only, never hardcode it elsewhere.
 */
export const siteConfig = {
  name: "APP_NAME",
  defaultLocale: "pl",
  locales: ["pl", "en"],
} as const;

export type Locale = (typeof siteConfig.locales)[number];
