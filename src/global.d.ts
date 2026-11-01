import type { routing } from "./i18n/routing";
import type common from "../messages/pl/common.json";
import type errors from "../messages/pl/errors.json";
import type home from "../messages/pl/home.json";
import type nav from "../messages/pl/nav.json";
import type sections from "../messages/pl/sections.json";
import type { formats } from "./lib/i18n/format";

// Type-safe next-intl: keys and locales are checked at compile time.
// Polish is the source of truth; `pnpm i18n:check` keeps English in sync.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: {
      common: typeof common;
      nav: typeof nav;
      home: typeof home;
      sections: typeof sections;
      errors: typeof errors;
    };
    Formats: typeof formats;
  }
}
