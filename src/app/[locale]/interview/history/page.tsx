import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor } from "@/components/shell/section-page";
import { InterviewHistory } from "@/features/interview/history";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/interview/history">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "interview.history" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: alternatesFor("/interview/history", locale),
    robots: { index: false, follow: true },
  };
}

/** Interview history and progress charts, from this browser's storage (Phase 11). */
export default async function InterviewHistoryPage() {
  const t = await getTranslations("interview");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6">
      <p className="mb-2 font-sans text-sm">
        <Link href="/interview">{t("hub.title")}</Link>
      </p>
      <h1 className="mb-3 text-3xl">{t("history.title")}</h1>
      <p className="mb-8 max-w-(--measure) text-base text-ink-muted">{t("history.lead")}</p>
      <InterviewHistory />
    </div>
  );
}
