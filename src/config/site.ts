/**
 * Brand constants. The product name is a placeholder until it's chosen; change it
 * here only, never hardcode it elsewhere. Locales live in src/i18n/routing.ts.
 */
export const siteConfig = {
  name: "APP_NAME",
  /** Channel URLs. `null` renders "soon" in the footer instead of a dead or fake link. */
  social: {
    tiktok: null,
    youtube: null,
    discord: null,
  } satisfies Record<"tiktok" | "youtube" | "discord", string | null> as Record<
    "tiktok" | "youtube" | "discord",
    string | null
  >,
} as const;
