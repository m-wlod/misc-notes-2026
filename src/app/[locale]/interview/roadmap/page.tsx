import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor } from "@/components/shell/section-page";
import { Badge } from "@/components/ui/display";
import { getCurriculum } from "@/features/curriculum";
import { kindInfo } from "@/features/interview/kinds";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

import { interviewRoadmap } from "../../../../../content/interview-roadmap";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/interview/roadmap">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "interview.roadmap" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: alternatesFor("/interview/roadmap", locale),
  };
}

/** Interview prep roadmap (Phase 11): topics → tracks, sessions and practice sets. Static. */
export default async function RoadmapPage({ params }: PageProps<"/[locale]/interview/roadmap">) {
  const locale = (await params).locale === "en" ? "en" : "pl";
  const t = await getTranslations("interview");
  const tracks = new Map(getCurriculum(locale).map((tr) => [tr.id, tr]));
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6">
      <p className="mb-2 font-sans text-sm">
        <Link href="/interview">{t("hub.title")}</Link>
      </p>
      <h1 className="mb-3 text-3xl">{t("roadmap.title")}</h1>
      <p className="mb-8 max-w-(--measure) text-base text-ink-muted">{t("roadmap.lead")}</p>
      <ol className="grid max-w-(--measure) gap-6">
        {interviewRoadmap.map((topic, i) => (
          <li key={topic.id} className="border-t border-rule pt-4">
            <h2 className="mb-1 text-xl">
              <span className="mr-2 num text-ink-muted">{i + 1}.</span>
              {topic.name[locale]}
            </h2>
            <p className="mb-3 text-base text-ink-muted">
              {topic.description ? topic.description[locale] : t("roadmap.soon")}
            </p>
            <dl className="grid gap-2 font-sans text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-ink-muted">{t("roadmap.learn")}</dt>
              <dd className="flex flex-wrap gap-x-4 gap-y-1">
                {topic.tracks.map((id) => {
                  const tr = tracks.get(id);
                  return tr ? (
                    <span key={id} className="flex flex-wrap gap-x-3">
                      <Link href={{ pathname: "/learn/[track]", params: { track: tr.slug } }}>
                        {tr.name}
                      </Link>
                      <Link
                        href={{ pathname: "/practice", query: { track: id } }}
                        className="text-ink-muted"
                      >
                        {t("roadmap.practice")}
                      </Link>
                    </span>
                  ) : null;
                })}
              </dd>
              {topic.sessions.length > 0 ? (
                <>
                  <dt className="text-ink-muted">{t("roadmap.train")}</dt>
                  <dd className="flex flex-wrap gap-2">
                    {topic.sessions.map((kind) => (
                      <Link
                        key={kind}
                        href={{
                          pathname: "/interview/[type]",
                          params: { type: kindInfo(kind).slug[locale] },
                        }}
                      >
                        <Badge>{t(`kinds.${kind}.title`)}</Badge>
                      </Link>
                    ))}
                  </dd>
                </>
              ) : null}
            </dl>
          </li>
        ))}
      </ol>
    </div>
  );
}
