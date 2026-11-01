import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor, SECTIONS } from "@/components/shell/section-page";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: { absolute: t("metaTitle") }, alternates: alternatesFor("/", locale) };
}

const ROADMAP = ["learn", "practice", "interview", "debunk", "lab"] as const;

/**
 * Honest pre-launch home. The real landing page (live simulation, sample exercise)
 * is Phase 19; until then this says what exists and what is coming.
 */
export default async function HomePage() {
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-16 pb-16 sm:px-6">
      <h1 className="mb-5 max-w-3xl text-3xl">{t("home.title")}</h1>
      <p className="mb-6 max-w-(--measure) font-serif text-reading">{t("home.lead")}</p>
      <p className="mb-14 max-w-(--measure) border-l-2 border-rule-strong pl-5 text-base text-ink-muted">
        {t("home.status")}
      </p>

      <h2 className="mb-6 border-b border-rule pb-2 text-xl">{t("home.sectionsHeading")}</h2>
      <ol className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {ROADMAP.map((key) => (
          <li key={key} className="grid grid-cols-[3rem_1fr] gap-x-3">
            <span className="pt-0.5 num text-xs text-ink-muted">
              {String(SECTIONS[key].phase).padStart(2, "0")}
            </span>
            <div>
              <Link
                href={SECTIONS[key].href}
                className="font-medium text-ink underline-offset-4 hover:underline"
              >
                {t(`sections.${key}.title`)}
              </Link>
              <p className="mt-1 text-sm text-ink-muted">{t(`sections.${key}.description`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
