import type { routing } from "./i18n/routing";
import type account from "../messages/pl/account.json";
import type auth from "../messages/pl/auth.json";
import type common from "../messages/pl/common.json";
import type content from "../messages/pl/content.json";
import type curriculum from "../messages/pl/curriculum.json";
import type errors from "../messages/pl/errors.json";
import type glossary from "../messages/pl/glossary.json";
import type home from "../messages/pl/home.json";
import type nav from "../messages/pl/nav.json";
import type onboarding from "../messages/pl/onboarding.json";
import type placement from "../messages/pl/placement.json";
import type reader from "../messages/pl/reader.json";
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
      auth: typeof auth;
      onboarding: typeof onboarding;
      placement: typeof placement;
      account: typeof account;
      content: typeof content;
      glossary: typeof glossary;
      curriculum: typeof curriculum;
      reader: typeof reader;
    };
    Formats: typeof formats;
  }
}
