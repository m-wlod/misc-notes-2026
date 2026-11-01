import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor } from "@/components/shell/section-page";
import { PlacementForm } from "@/features/placement/placement-form";
import { PLACEMENT_IDS } from "@/features/placement/questions";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/placement">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "placement" });
  return {
    title: t("metaTitle"),
    description: t("lead"),
    alternates: alternatesFor("/placement", locale),
  };
}

/**
 * Works signed in or out: anyone can check their level; signed-in users get the result
 * saved to their profile. Only question ids are passed to the client.
 */
export default async function PlacementPage() {
  const t = await getTranslations("placement");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-4 text-3xl">{t("metaTitle")}</h1>
      <p className="mb-10 max-w-(--measure) text-base text-ink-muted">{t("lead")}</p>
      <PlacementForm ids={PLACEMENT_IDS} />
    </div>
  );
}
