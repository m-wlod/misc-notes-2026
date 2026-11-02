import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor } from "@/components/shell/section-page";
import { Notebook } from "@/features/python/notebook";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { DATASET_IDS } from "@/lib/datasets/generate";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab/notebook">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "python.notebook" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: alternatesFor("/lab/notebook", locale),
  };
}

/** The Python notebook (Phase 13): a playground with sample data. Static shell. */
export default async function NotebookPage() {
  const t = await getTranslations("python.notebook");
  const s = await getTranslations("sims.lab");
  // Raw: the code contains braces (f-strings), which ICU would read as placeholders.
  const starter = [t.raw("starterData") as string, t.raw("starterStats") as string];
  return (
    <div className="mx-auto max-w-4xl px-4 pt-12 pb-16 sm:px-6">
      <p className="mb-2 font-sans text-sm">
        <Link href="/lab">{s("title")}</Link>
      </p>
      <h1 className="mb-3 text-3xl">{t("title")}</h1>
      <p className="mb-2 max-w-(--measure) text-base text-ink-muted">{t("lead")}</p>
      <p className="mb-6 font-sans text-xs text-ink-muted">{t("keys")}</p>
      <Notebook starter={starter} />
      <section className="mt-10 border-t border-rule pt-6">
        <h2 className="mb-2 text-xl">{t("datasets")}</h2>
        <p className="mb-3 max-w-(--measure) text-sm text-ink-muted">{t("datasetsNote")}</p>
        <ul className="flex flex-col gap-1.5 font-sans text-sm">
          {DATASET_IDS.map((id) => (
            <li key={id} data-dataset={id}>
              {t(`dataset.${id}`)} ·{" "}
              <a href={`/datasets/${id}.csv`} download>
                {t("csv")}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
