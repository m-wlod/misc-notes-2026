import "server-only";

import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { legal } from "#content";
import { alternatesFor, SECTIONS } from "@/components/shell/section-page";
import { env } from "@/env";
import { ConsentSettings } from "@/features/consent/consent-ui";
import { MdxContent } from "@/features/content/mdx-content";
import { ogMeta } from "@/features/seo/og";
import type { Locale } from "@/i18n/routing";

/**
 * Legal pages (Phase 21b) from content/<locale>/legal/<id>.mdx. Drafts say so at the top
 * and stay out of search engines until the owner's legal review sets `draft: false`.
 * The cookies page also carries the consent settings.
 */
export type LegalId = (typeof legal)[number]["id"];

const SECTION: Record<LegalId, keyof typeof SECTIONS> = {
  privacy: "privacy",
  terms: "terms",
  cookies: "cookies",
  disclaimer: "disclaimer",
  community: "community",
  corrections: "corrections",
};

function pageOf(id: LegalId, locale: Locale) {
  return (
    legal.find((p) => p.id === id && p.locale === locale) ??
    legal.find((p) => p.id === id && p.locale === "pl")
  );
}

export function legalPage(id: LegalId) {
  const key = SECTION[id];
  const { href } = SECTIONS[key];

  async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const locale = (await params).locale as Locale;
    const page = pageOf(id, locale);
    const title = page?.title ?? id;
    const description = page?.description ?? "";
    return {
      title,
      description,
      alternates: alternatesFor(href, locale),
      ...(page?.draft ? { robots: { index: false, follow: true } } : {}),
      ...ogMeta({ kind: "page", id: key, locale, title, description }),
    };
  }

  async function Page({ params }: { params: Promise<{ locale: string }> }) {
    const locale = (await params).locale as Locale;
    const page = pageOf(id, locale);
    const t = await getTranslations("legal");
    const format = await getFormatter();
    if (!page) return null;
    return (
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
        <article data-legal={id} className="max-w-(--measure)">
          <h1 className="mb-3 text-3xl">{page.title}</h1>
          <p className="mb-6 num font-sans text-sm text-ink-muted">
            {t("updated", { date: format.dateTime(new Date(page.updated), { dateStyle: "long" }) })}
          </p>
          {page.draft ? (
            <p
              role="note"
              data-legal-draft
              className="mb-8 border-l-2 border-rule-strong py-1 pl-4 font-sans text-sm text-ink"
            >
              {t("draft")}
            </p>
          ) : null}
          {id === "cookies" ? (
            <ConsentSettings analyticsConfigured={Boolean(env.NEXT_PUBLIC_POSTHOG_KEY)} />
          ) : null}
          <div className="legal-body font-serif text-reading">
            <MdxContent code={page.body} />
          </div>
        </article>
      </div>
    );
  }

  return { Page, generateMetadata };
}
