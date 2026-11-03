import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor } from "@/components/shell/section-page";
import { getGlossary } from "@/features/content/lessons";
import { lessonHref, lessonNodes } from "@/features/curriculum";
import { sortEntries } from "@/features/glossary/glossary";
import { GlossarySearch } from "@/features/glossary/glossary-search";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/glossary">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "sections" });
  return {
    title: t("glossary.title"),
    description: t("glossary.description"),
    alternates: alternatesFor("/glossary", locale),
  };
}

/** Static A–Z glossary from content/glossary/*.yaml, searchable on the client. */
export default async function GlossaryPage({ params }: PageProps<"/[locale]/glossary">) {
  const locale = (await params).locale as Locale;
  const other: Locale = locale === "pl" ? "en" : "pl";
  const t = await getTranslations("glossary");
  const tSections = await getTranslations("sections");
  const terms = getGlossary();
  const nodes = lessonNodes(locale);
  const entries = sortEntries(
    terms.map((term) => {
      const node = term.lesson ? nodes[term.lesson] : undefined;
      return {
        id: term.id,
        name: term.name[locale],
        otherName: term.name[other],
        definition: term.definition[locale],
        sample: term.sample,
        lesson: node
          ? { href: getPathname({ href: lessonHref(node), locale }), title: node.title }
          : undefined,
      };
    }),
    locale,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-3 text-3xl">{tSections("glossary.title")}</h1>
      <p className="mb-8 max-w-(--measure) text-base text-ink-muted">{t("lead")}</p>
      {terms.some((term) => term.sample) ? (
        <p
          role="note"
          className="mb-8 max-w-(--measure) border-l-2 border-accent py-1 pl-4 text-sm"
        >
          {t("sampleNote")}
        </p>
      ) : null}
      <GlossarySearch entries={entries} locale={locale} />
    </div>
  );
}
