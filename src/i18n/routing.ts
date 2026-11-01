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
    "/practice": { pl: "/praktyka", en: "/practice" },
    "/interview": { pl: "/rozmowa", en: "/interview" },
    "/debunk": "/debunk",
    "/glossary": { pl: "/slowniczek", en: "/glossary" },
    "/lab": { pl: "/laboratorium", en: "/lab" },
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
