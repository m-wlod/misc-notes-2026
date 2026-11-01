import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor } from "@/components/shell/section-page";
import { Badge } from "@/components/ui/display";
import { getCurriculum } from "@/features/curriculum";
import { CurriculumTabs } from "@/features/curriculum/views";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/textbook">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "curriculum.textbook" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: alternatesFor("/textbook", locale),
  };
}

/** The curriculum as a numbered table of contents (track n, module n.m, lesson n.m.k). */
export default async function TextbookPage({ params }: PageProps<"/[locale]/textbook">) {
  const locale = (await params).locale as Locale;
  const t = await getTranslations("curriculum");
  const tracks = getCurriculum(locale);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-3 text-3xl">{t("textbook.title")}</h1>
      <p className="mb-6 max-w-(--measure) text-base text-ink-muted">{t("textbook.lead")}</p>
      <CurriculumTabs current="textbook" />

      <ol className="grid max-w-(--measure) gap-10">
        {tracks.map((track) => (
          <li key={track.id}>
            <h2 className="mb-3 border-b border-rule pb-1 text-xl">
              <span className="mr-3 num text-ink-muted">{track.number}</span>
              <Link
                href={{ pathname: "/learn/[track]", params: { track: track.slug } }}
                className="underline-offset-4 hover:underline"
              >
                {track.name}
              </Link>
            </h2>
            <ol className="grid gap-4">
              {track.modules.map((mod) => (
                <li key={mod.id}>
                  <h3 className="mb-1.5 font-sans text-sm font-semibold text-ink">
                    <span className="mr-3 num text-ink-muted">{mod.number}</span>
                    {mod.name}
                  </h3>
                  <ol className="grid gap-1">
                    {mod.lessons.map((lesson) => (
                      <li
                        key={lesson.id}
                        className="flex flex-wrap items-baseline gap-x-3 font-serif text-base"
                      >
                        <span className="w-14 shrink-0 num text-xs text-ink-muted">
                          {lesson.number}
                        </span>
                        <span className="text-ink">{lesson.title}</span>
                        <span className="font-sans text-xs text-ink-muted">
                          {t("level", { level: lesson.level })} ·{" "}
                          {t("minutes", { minutes: lesson.minutes })}
                        </span>
                        {lesson.isStub ? <Badge>{t("stub")}</Badge> : null}
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
