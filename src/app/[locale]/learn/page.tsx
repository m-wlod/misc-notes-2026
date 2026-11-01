import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor } from "@/components/shell/section-page";
import { getCurriculum, titlesFor } from "@/features/curriculum";
import { LessonPath } from "@/features/curriculum/lesson-path";
import { CurriculumTabs, UnitMeta } from "@/features/curriculum/views";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "curriculum.path" });
  return { title: t("title"), description: t("lead"), alternates: alternatesFor("/learn", locale) };
}

/** The learning path: every track, module and lesson node (static; state applied on the client). */
export default async function LearnPage({ params }: PageProps<"/[locale]/learn">) {
  const locale = (await params).locale as Locale;
  const t = await getTranslations("curriculum");
  const tracks = getCurriculum(locale);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-3 text-3xl">{t("path.title")}</h1>
      <p className="mb-6 max-w-(--measure) text-base text-ink-muted">{t("path.lead")}</p>
      <CurriculumTabs current="path" />
      <p className="mb-12 max-w-(--measure) font-sans text-sm text-ink-muted">
        {t("path.progressNote")}
      </p>

      <div className="grid gap-16">
        {tracks.map((track) => (
          <section
            key={track.id}
            aria-labelledby={`track-${track.id}`}
            className="max-w-(--measure)"
          >
            <p className="num text-xs text-ink-muted">{t("track", { number: track.number })}</p>
            <h2 id={`track-${track.id}`} className="mb-2 text-2xl">
              <Link
                href={{ pathname: "/learn/[track]", params: { track: track.slug } }}
                className="underline-offset-4 hover:underline"
              >
                {track.name}
              </Link>
            </h2>
            <p className="mb-2 text-base text-ink-muted">{track.description}</p>
            <UnitMeta unit={track} />
            <div className="mt-6 grid gap-8">
              {track.modules.map((mod) => (
                <div key={mod.id}>
                  <h3 className="mb-4 font-sans text-sm font-semibold text-ink">
                    <span className="mr-2 num text-ink-muted">{mod.number}</span>
                    {mod.name}
                  </h3>
                  <LessonPath lessons={mod.lessons} titles={titlesFor(locale, mod.lessons)} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
