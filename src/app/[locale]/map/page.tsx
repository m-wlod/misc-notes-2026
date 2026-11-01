import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor } from "@/components/shell/section-page";
import { getCurriculum, lessonHref } from "@/features/curriculum";
import { CurriculumMap, type MapNode } from "@/features/curriculum/curriculum-map";
import { layoutDag } from "@/features/curriculum/layout-dag";
import { CurriculumTabs } from "@/features/curriculum/views";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/map">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "curriculum.map" });
  return { title: t("title"), description: t("lead"), alternates: alternatesFor("/map", locale) };
}

/** The prerequisite graph of every lesson. Layout is computed here, at build time. */
export default async function MapPage({ params }: PageProps<"/[locale]/map">) {
  const locale = (await params).locale as Locale;
  const t = await getTranslations("curriculum");
  const tracks = getCurriculum(locale);

  const lessons = tracks.flatMap((track) =>
    track.modules.flatMap((mod) => mod.lessons.map((lesson) => ({ track, mod, lesson }))),
  );
  const layout = layoutDag(
    lessons.map(({ lesson }) => ({ id: lesson.id, prerequisites: lesson.prerequisites })),
  );
  const placed = new Map(layout.nodes.map((n) => [n.id, n]));
  const nodes: MapNode[] = lessons.map(({ track, lesson }) => {
    const at = placed.get(lesson.id);
    const url = getPathname({ href: lessonHref(lesson), locale });
    return {
      id: lesson.id,
      number: lesson.number,
      title: lesson.title,
      level: lesson.level,
      track: track.id,
      prerequisites: lesson.prerequisites,
      url,
      x: at?.x ?? 0,
      y: at?.y ?? 0,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-3 text-3xl">{t("map.title")}</h1>
      <p className="mb-2 max-w-(--measure) text-base text-ink-muted">{t("map.lead")}</p>
      <p className="mb-6 font-sans text-sm">
        <Link href="/textbook" className="text-accent-text underline underline-offset-2">
          {t("map.textAlternative")}
        </Link>
      </p>
      <CurriculumTabs current="map" />
      <CurriculumMap
        nodes={nodes}
        edges={layout.edges}
        width={layout.width}
        height={layout.height}
        tracks={tracks.map((tr) => ({ id: tr.id, name: `${String(tr.number)}. ${tr.name}` }))}
      />
    </div>
  );
}
