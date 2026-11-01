import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { alternatesForPaths } from "@/components/shell/section-page";
import { findModule, getCurriculum, moduleSlugs, titlesFor } from "@/features/curriculum";
import { LessonPath } from "@/features/curriculum/lesson-path";
import { ModuleProgress } from "@/features/curriculum/module-progress";
import { UnitMeta } from "@/features/curriculum/views";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/learn/[track]/[module]">;

const moduleHref = (track: string, module: string) =>
  ({ pathname: "/learn/[track]/[module]", params: { track, module } }) as const;

/**
 * Every track/module pair for the locale. [track] has no layout, so this route receives
 * only the locale from its parents and must generate the track slug itself.
 */
export function generateStaticParams({ params }: { params: { locale: string } }) {
  return getCurriculum(params.locale as Locale).flatMap((t) =>
    t.modules.map((m) => ({ track: t.slug, module: m.slug })),
  );
}

/** The module in this locale. Slugs from the other locale are redirected earlier, in proxy.ts. */
async function resolve(params: Props["params"]) {
  const { locale: raw, track: trackSlug, module: moduleSlug } = await params;
  const locale = raw as Locale;
  const found = findModule(locale, trackSlug, moduleSlug);
  if (found) return { locale, ...found };
  notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, track, module: mod } = await resolve(params);
  const slugs = moduleSlugs(track.id, mod.id);
  return {
    title: `${mod.name} · ${track.name}`,
    alternates: alternatesForPaths(locale, (l) =>
      getPathname({
        href: moduleHref(slugs?.[l].track ?? track.slug, slugs?.[l].module ?? mod.slug),
        locale: l,
      }),
    ),
  };
}

export default async function ModulePage({ params }: Props) {
  const { locale, track, module: mod } = await resolve(params);
  const t = await getTranslations("curriculum");

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <p className="mb-6 font-sans text-sm">
        <Link
          href={{ pathname: "/learn/[track]", params: { track: track.slug } }}
          className="text-accent-text underline underline-offset-2"
        >
          ← {track.name}
        </Link>
      </p>
      <p className="num text-xs text-ink-muted">{t("module", { number: mod.number })}</p>
      <h1 className="mb-3 text-3xl">{mod.name}</h1>
      <UnitMeta unit={mod} />
      <ModuleProgress lessonIds={mod.lessons.map((l) => l.id)} />
      <div className="mt-10 max-w-(--measure)">
        <LessonPath lessons={mod.lessons} titles={titlesFor(locale, mod.lessons)} />
      </div>
    </div>
  );
}
