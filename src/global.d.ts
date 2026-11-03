import type { routing } from "./i18n/routing";
import type account from "../messages/pl/account.json";
import type auth from "../messages/pl/auth.json";
import type certificates from "../messages/pl/certificates.json";
import type challenge from "../messages/pl/challenge.json";
import type common from "../messages/pl/common.json";
import type community from "../messages/pl/community.json";
import type content from "../messages/pl/content.json";
import type curriculum from "../messages/pl/curriculum.json";
import type debunk from "../messages/pl/debunk.json";
import type errors from "../messages/pl/errors.json";
import type exercises from "../messages/pl/exercises.json";
import type gamification from "../messages/pl/gamification.json";
import type glossary from "../messages/pl/glossary.json";
import type home from "../messages/pl/home.json";
import type interview from "../messages/pl/interview.json";
import type nav from "../messages/pl/nav.json";
import type notes from "../messages/pl/notes.json";
import type notify from "../messages/pl/notify.json";
import type onboarding from "../messages/pl/onboarding.json";
import type placement from "../messages/pl/placement.json";
import type python from "../messages/pl/python.json";
import type reader from "../messages/pl/reader.json";
import type review from "../messages/pl/review.json";
import type sections from "../messages/pl/sections.json";
import type sims from "../messages/pl/sims.json";
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
      notes: typeof notes;
      exercises: typeof exercises;
      interview: typeof interview;
      sims: typeof sims;
      python: typeof python;
      gamification: typeof gamification;
      review: typeof review;
      challenge: typeof challenge;
      certificates: typeof certificates;
      notify: typeof notify;
      debunk: typeof debunk;
      community: typeof community;
    };
    Formats: typeof formats;
  }
}
