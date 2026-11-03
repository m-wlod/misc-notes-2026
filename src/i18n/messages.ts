import type { Locale } from "./routing";

/**
 * Message files are split by feature (messages/<locale>/<namespace>.json) and merged
 * here. Polish is the source of truth for types; `pnpm i18n:check` keeps English in sync.
 */
export const NAMESPACES = [
  "common",
  "nav",
  "home",
  "sections",
  "errors",
  "auth",
  "onboarding",
  "placement",
  "account",
  "content",
  "glossary",
  "curriculum",
  "reader",
  "notes",
  "exercises",
  "interview",
  "sims",
  "python",
  "gamification",
  "review",
  "challenge",
  "certificates",
  "notify",
  "debunk",
  "community",
  "admin",
  "videos",
  "links",
] as const;
export type Namespace = (typeof NAMESPACES)[number];

export async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    NAMESPACES.map(
      async (ns) =>
        [
          ns,
          ((await import(`../../messages/${locale}/${ns}.json`)) as { default: unknown }).default,
        ] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<Namespace, Record<string, unknown>>;
}
