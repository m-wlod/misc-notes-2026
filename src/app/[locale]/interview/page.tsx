import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor } from "@/components/shell/section-page";
import { Badge } from "@/components/ui/display";
import { KINDS } from "@/features/interview/kinds";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/interview">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "interview.hub" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: alternatesFor("/interview", locale),
  };
}

/** The interview room (Phase 11): the five session types. Static. */
export default async function InterviewPage({ params }: PageProps<"/[locale]/interview">) {
  const locale = (await params).locale === "en" ? "en" : "pl";
  const t = await getTranslations("interview");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-3 text-3xl">{t("hub.title")}</h1>
      <p className="mb-4 max-w-(--measure) text-base text-ink-muted">{t("hub.lead")}</p>
      <p className="mb-8 font-sans text-sm">
        <Link href="/interview/roadmap">{t("roadmap.link")}</Link>
        <span aria-hidden="true" className="mx-2 text-ink-muted">
          ·
        </span>
        <Link href="/interview/history">{t("hub.history")}</Link>
      </p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {KINDS.map((k) => (
          <li
            key={k.kind}
            data-kind={k.kind}
            className="flex flex-col gap-2 rounded-md border border-rule-strong bg-surface px-5 py-4"
          >
            <h2 className="text-xl">
              {k.playable ? (
                <Link href={{ pathname: "/interview/[type]", params: { type: k.slug[locale] } }}>
                  {t(`kinds.${k.kind}.title`)}
                </Link>
              ) : (
                t(`kinds.${k.kind}.title`)
              )}
            </h2>
            <p className="text-base text-ink">{t(`kinds.${k.kind}.description`)}</p>
            <p className="mt-auto flex flex-wrap items-center gap-2 num font-sans text-xs text-ink-muted">
              <span>
                {t("hub.length", {
                  size: k.size,
                  unit: t(`kinds.${k.kind}.unit`),
                  minutes: k.minutes,
                })}
              </span>
              {k.offline ? <Badge>{t("hub.offline")}</Badge> : <Badge>{t("hub.ai")}</Badge>}
              {k.playable ? null : <Badge>{t("hub.soon")}</Badge>}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
