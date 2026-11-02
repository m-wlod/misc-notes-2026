import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor } from "@/components/shell/section-page";
import { SIMS } from "@/features/sims/registry";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/lab">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "sims.lab" });
  return { title: t("title"), description: t("lead"), alternates: alternatesFor("/lab", locale) };
}

/** The Lab (Phase 12): every simulation. Static. */
export default async function LabPage({ params }: PageProps<"/[locale]/lab">) {
  const locale = (await params).locale === "en" ? "en" : "pl";
  const t = await getTranslations("sims");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-3 text-3xl">{t("lab.title")}</h1>
      <p className="mb-8 max-w-(--measure) text-base text-ink-muted">{t("lab.lead")}</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {SIMS.map((s) => (
          <li
            key={s.id}
            data-sim={s.id}
            className="rounded-md border border-rule-strong bg-surface px-5 py-4"
          >
            <h2 className="mb-1 text-xl">
              <Link href={{ pathname: "/lab/sims/[id]", params: { id: s.slug[locale] } }}>
                {t(`${s.id}.title` as "coin-walk.title")}
              </Link>
            </h2>
            <p className="text-base text-ink">{t(`${s.id}.short` as "coin-walk.short")}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
