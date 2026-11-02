import { defineRouting } from "next-intl/routing";

/**
 * URL scheme: every page is locale-prefixed (`/pl/…`, `/en/…`) and Polish pages use
 * Polish slugs (decision 2026-11-01). Keys are internal route names; values are the
 * public paths per locale. Changing a published slug needs a redirect, so treat these
 * as permanent.
 */
export const routing = defineRouting({
  locales: ["pl", "en"],
  defaultLocale: "pl",
  localePrefix: "always",
  pathnames: {
    "/": "/",
    "/learn": { pl: "/nauka", en: "/learn" },
    "/learn/[track]": { pl: "/nauka/[track]", en: "/learn/[track]" },
    "/learn/[track]/[module]": { pl: "/nauka/[track]/[module]", en: "/learn/[track]/[module]" },
    "/learn/[track]/[module]/[lesson]": {
      pl: "/nauka/[track]/[module]/[lesson]",
      en: "/learn/[track]/[module]/[lesson]",
    },
    "/textbook": { pl: "/podrecznik", en: "/textbook" },
    "/map": { pl: "/mapa", en: "/map" },
    "/notes": { pl: "/notatki", en: "/notes" },
    "/practice": { pl: "/praktyka", en: "/practice" },
    "/practice/[exercise]": { pl: "/praktyka/[exercise]", en: "/practice/[exercise]" },
    "/interview": { pl: "/rozmowa", en: "/interview" },
    "/interview/history": { pl: "/rozmowa/historia", en: "/interview/history" },
    "/interview/roadmap": { pl: "/rozmowa/plan-przygotowan", en: "/interview/roadmap" },
    "/interview/[type]": { pl: "/rozmowa/[type]", en: "/interview/[type]" },
    "/debunk": "/debunk",
    "/glossary": { pl: "/slowniczek", en: "/glossary" },
    "/lab": { pl: "/laboratorium", en: "/lab" },
    "/lab/sims/[id]": { pl: "/laboratorium/symulacje/[id]", en: "/lab/sims/[id]" },
    "/lab/notebook": { pl: "/laboratorium/notatnik", en: "/lab/notebook" },
    "/league": { pl: "/liga", en: "/league" },
    "/review": { pl: "/powtorka", en: "/review" },
    "/challenge": { pl: "/wyzwanie", en: "/challenge" },
    "/profile": { pl: "/profil", en: "/profile" },
    "/settings": { pl: "/ustawienia", en: "/settings" },
    "/about": { pl: "/o-projekcie", en: "/about" },
    "/privacy": { pl: "/prywatnosc", en: "/privacy" },
    "/terms": { pl: "/regulamin", en: "/terms" },
    "/cookies": "/cookies",
    "/disclaimer": { pl: "/zastrzezenia", en: "/disclaimer" },
    "/sign-in": { pl: "/logowanie", en: "/sign-in" },
    "/onboarding": { pl: "/pierwsze-kroki", en: "/onboarding" },
    "/placement": { pl: "/test-poziomujacy", en: "/placement" },
    "/dev/content-preview": "/dev/content-preview",
    "/styleguide": "/styleguide",
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
/** Routes without dynamic segments: usable as a plain href (nav, sitemap, metadata). */
export type StaticPathname = Exclude<AppPathname, `${string}[${string}`>;
