import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { alternatesForPaths } from "@/components/shell/section-page";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/display";
import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { Discussion } from "@/features/community/discussion";
import { DepthToggle } from "@/features/content/depth-toggle";
import { getLesson } from "@/features/content/lessons";
import { MdxContent } from "@/features/content/mdx-content";
import { lessonHref, lessonNodes } from "@/features/curriculum";
import { Checker } from "@/features/debunk/checkers/checker";
import { allSlugs, entryBySlug, slugsOf } from "@/features/debunk/entries";
import { CorrectionForm, FinishTracker } from "@/features/debunk/forms";
import { VerdictBadge } from "@/features/debunk/verdict-badge";
import { getPathname, Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/debunk/[slug]">;

export function generateStaticParams() {
  return allSlugs();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  const e = entryBySlug(slug, locale, true);
  if (!e) return {};
  const slugs = slugsOf(e.id);
  return {
    title: e.claim,
    description: e.summary,
    alternates: alternatesForPaths(locale, (l) =>
      getPathname({
        href: { pathname: "/debunk/[slug]", params: { slug: slugs[l] ?? slugs.pl ?? slug } },
        locale: l,
      }),
    ),
    openGraph: {
      images: [
        { url: `/api/share/debunk?id=${e.id}&lang=${locale}&format=og`, width: 1200, height: 630 },
      ],
    },
  };
}

/** One Debunk Lab entry (Phase 16). `?nagranie=1` is the 9:16 recording layout. */
export default function DebunkEntryPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-12 h-96 max-w-(--measure)" />}>
      <Entry params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Entry({ params, searchParams }: Props) {
  await connection();
  const { locale: raw, slug } = await params;
  const locale = (routing.locales as readonly string[]).includes(raw) ? (raw as Locale) : "pl";
  const e = entryBySlug(slug, locale, isStyleguideEnabled(env));
  if (!e) notFound();
  const t = await getTranslations("debunk");
  const recording = (await searchParams).nagranie === "1";
  const share = (format: "og" | "story") =>
    `/api/share/debunk?id=${e.id}&lang=${locale}&format=${format}`;

  if (recording) {
    return (
      <div className="flex justify-center px-4 py-8">
        <div
          data-recording=""
          className="grid aspect-[9/16] w-full max-w-[540px] content-between gap-6 overflow-hidden rounded-md border border-rule-strong bg-bg px-6 py-8"
        >
          <div className="grid gap-3">
            <VerdictBadge verdict={e.verdict} className="justify-self-start text-sm" />
            <p className="font-serif text-2xl leading-tight">„{e.claim}”</p>
          </div>
          {e.checker ? <Checker id={e.checker} /> : null}
          <a href={share("story")} download className={buttonClass("secondary", "sm")}>
            {t("entry.shareImage")} (1080×1920)
          </a>
        </div>
      </div>
    );
  }

  const nodes = lessonNodes(locale);
  return (
    <article
      data-debunk-entry={e.id}
      className="mx-auto max-w-(--measure) px-4 pt-12 pb-16 sm:px-0"
    >
      <p className="mb-4 font-sans text-sm">
        <Link href="/debunk">{t("entry.back")}</Link>
      </p>
      {e.fallback ? (
        <p
          role="note"
          className="mb-4 border-l-2 border-rule-strong pl-3 font-sans text-sm text-ink-muted"
        >
          {t("entry.fallback")}
        </p>
      ) : null}
      <p className="mb-2 font-sans text-xs tracking-wide text-ink-muted uppercase">
        {t("entry.claim")} · {t(`category.${e.category}`)}
        {e.sample ? ` · ${t("index.sample")}` : ""}
      </p>
      <h1 className="mb-4 text-3xl">„{e.claim}”</h1>
      <p className="mb-2 flex items-center gap-2 font-sans text-sm">
        <span className="text-ink-muted">{t("entry.verdictLabel")}:</span>
        <VerdictBadge verdict={e.verdict} />
      </p>
      <p className="mb-6 font-serif text-reading">{e.summary}</p>
      <div className="mb-6">
        <DepthToggle />
      </div>
      <MdxContent code={e.body} />

      {e.relatedLessons.length > 0 || e.relatedVideo ? (
        <section aria-labelledby="related-title" className="mt-10 border-t border-rule pt-6">
          <h2 id="related-title" className="mb-3 text-xl">
            {t("entry.related")}
          </h2>
          <ul className="grid gap-1 font-sans text-sm">
            {e.relatedLessons.map((id) => {
              const node = nodes[id];
              const title =
                node?.title ?? getLesson(id, locale, { includeDrafts: true })?.lesson.title ?? id;
              return (
                <li key={id}>{node ? <Link href={lessonHref(node)}>{title}</Link> : title}</li>
              );
            })}
            {e.relatedVideo ? (
              <li>
                {t("entry.video")}: <a href={e.relatedVideo.url}>{e.relatedVideo.title}</a>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="sources-title" className="mt-10 border-t border-rule pt-6">
        <h2 id="sources-title" className="mb-3 text-xl">
          {t("entry.sources")}
        </h2>
        {e.sources.length === 0 ? (
          <p className="font-sans text-sm text-ink-muted">{t("entry.noSources")}</p>
        ) : (
          <ul className="grid gap-1 font-sans text-sm">
            {e.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} rel="nofollow noopener">
                  {s.title}
                </a>{" "}
                <span className="text-ink-muted">({s.date})</span> ·{" "}
                <a href={s.archive} rel="nofollow noopener">
                  {t("entry.archived")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 grid gap-4 border-t border-rule pt-6">
        <div className="flex flex-wrap gap-3 font-sans text-sm">
          <a href={share("og")} download>
            {t("entry.shareImage")}
          </a>
          <a href="?nagranie=1">{t("entry.recording")}</a>
        </div>
        <CorrectionForm entryId={e.id} />
        <p className="font-sans text-xs text-ink-muted">{t("entry.principle")}</p>
      </section>
      <FinishTracker entryId={e.id} />
      <Discussion target="debunk" id={e.id} />
    </article>
  );
}
