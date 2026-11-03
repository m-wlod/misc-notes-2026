import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { alternatesFor } from "@/components/shell/section-page";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/display";
import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { CATEGORIES, listEntries, VERDICTS } from "@/features/debunk/entries";
import { applyDebunkFilters, parseDebunkFilters } from "@/features/debunk/filters";
import { SubmitClaimForm } from "@/features/debunk/forms";
import { VerdictBadge } from "@/features/debunk/verdict-badge";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/debunk">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "debunk.index" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: alternatesFor("/debunk", locale),
  };
}

/** Debunk Lab index (Phase 16): entries with filters, and the claim submission form. */
export default async function DebunkPage({ params, searchParams }: PageProps<"/[locale]/debunk">) {
  const t = await getTranslations("debunk");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-3 text-3xl">{t("index.title")}</h1>
      <p className="mb-2 max-w-(--measure) text-base text-ink-muted">{t("index.lead")}</p>
      <p className="mb-8 max-w-(--measure) font-sans text-sm text-ink-muted">
        {t("entry.principle")}
      </p>
      <Suspense fallback={<Skeleton className="h-64 max-w-(--measure)" />}>
        <Entries params={params} searchParams={searchParams} />
      </Suspense>
      <section aria-labelledby="submit-title" className="mt-14 border-t border-rule pt-8">
        <h2 id="submit-title" className="mb-2 text-xl">
          {t("submit.title")}
        </h2>
        <p className="mb-4 max-w-(--measure) font-sans text-sm text-ink-muted">
          {t("submit.lead")}
        </p>
        <SubmitClaimForm />
      </section>
    </div>
  );
}

async function Entries({
  params,
  searchParams,
}: Pick<PageProps<"/[locale]/debunk">, "params" | "searchParams">) {
  await connection();
  const locale = (await params).locale === "en" ? "en" : "pl";
  const t = await getTranslations("debunk");
  const all = listEntries(locale, isStyleguideEnabled(env));
  const filters = parseDebunkFilters(await searchParams, CATEGORIES, VERDICTS);
  const shown = applyDebunkFilters(all, filters);
  const base = getPathname({ href: "/debunk", locale });

  if (all.length === 0) return <p className="font-serif text-reading">{t("index.empty")}</p>;
  return (
    <div className="grid gap-6">
      <form
        method="get"
        action={base}
        className="flex flex-wrap items-end gap-3"
        aria-label={t("index.filters")}
      >
        <label className="grid gap-1 font-sans text-sm text-ink">
          {t("index.category")}
          <select
            name="kategoria"
            defaultValue={filters.category ?? ""}
            className="h-10 rounded border border-rule-strong bg-surface px-2"
          >
            <option value="">{t("index.all")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 font-sans text-sm text-ink">
          {t("index.verdict")}
          <select
            name="werdykt"
            defaultValue={filters.verdict ?? ""}
            className="h-10 rounded border border-rule-strong bg-surface px-2"
          >
            <option value="">{t("index.all")}</option>
            {VERDICTS.map((v) => (
              <option key={v} value={v}>
                {t(`verdict.${v}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass("secondary")}>
          {t("index.apply")}
        </button>
        {filters.category || filters.verdict ? (
          <a href={base} className="font-sans text-sm">
            {t("index.clear")}
          </a>
        ) : null}
      </form>
      <p role="status" className="font-sans text-sm text-ink-muted">
        {t("index.count", { n: shown.length })}
      </p>
      {shown.length === 0 ? (
        <p className="font-serif text-reading">{t("index.none")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" data-debunk-list="">
          {shown.map((e) => (
            <li
              key={e.id}
              data-entry={e.id}
              className="grid content-start gap-2 rounded-md border border-rule-strong bg-surface px-5 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <VerdictBadge verdict={e.verdict} />
                <span className="font-sans text-xs text-ink-muted">
                  {t(`category.${e.category}`)}
                  {e.sample ? ` · ${t("index.sample")}` : ""}
                </span>
              </div>
              <h2 className="text-lg">
                <Link href={{ pathname: "/debunk/[slug]", params: { slug: e.slug } }}>
                  „{e.claim}”
                </Link>
              </h2>
              <p className="font-sans text-sm text-ink-muted">{e.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
