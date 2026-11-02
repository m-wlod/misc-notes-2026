import { getTranslations } from "next-intl/server";

import { VideoEmbed } from "@/components/content/video-embed";
import { buttonClass } from "@/components/ui/button";
import { LessonView } from "@/features/content/lesson-view";
import { showsBody, type ResolvedLesson } from "@/features/content/lessons";
import { lessonHref, type LessonNode, type LessonPlace } from "@/features/curriculum";
import { HighlightLayer } from "@/features/notes/highlight-layer";
import { BookmarkButton, LessonNotes } from "@/features/notes/lesson-notes";
import { Link } from "@/i18n/navigation";

import {
  CompleteLesson,
  ReaderToc,
  ReadingProgress,
  ResumeReading,
  SectionTracker,
  type TocItem,
} from "./reader-client";

type TocEntry = { title: string; url: string; items: TocEntry[] };

function flattenToc(entries: readonly TocEntry[], depth: 2 | 3 = 2): TocItem[] {
  return entries.flatMap((e) => [
    { id: decodeURIComponent(e.url.replace(/^#/, "")), title: e.title, depth },
    ...(depth === 2 ? flattenToc(e.items, 3) : []),
  ]);
}

type ReaderProps = ResolvedLesson & {
  /** Where the lesson sits in the curriculum (absent for the sample in the preview). */
  place?: LessonPlace | undefined;
  neighbours: { prev: LessonNode | null; next: LessonNode | null };
  /** Internal preview: show drafts' bodies for review. */
  preview?: boolean;
  /** Exercises that practise this lesson (published ones; the preview counts samples too). */
  practiceCount?: number;
  /** Titles of prerequisites, by id. */
  prerequisiteTitles: Readonly<Record<string, LessonNode | undefined>>;
};

/**
 * The lesson reader: reading progress, table of contents (sticky on wide screens,
 * collapsible on phones), the lesson, prerequisites, "mark as understood" with the next
 * lesson, and previous/next. Shared by lesson pages and the content preview.
 */
export async function Reader({
  lesson,
  fallback,
  place,
  neighbours,
  prerequisiteTitles,
  preview = false,
  practiceCount = 0,
}: ReaderProps) {
  const t = await getTranslations("reader");
  const tEx = await getTranslations("exercises");
  // Unpublished lessons read like stubs on public pages (review workflow).
  const withBody = showsBody(lesson, preview);
  const toc = withBody ? flattenToc(lesson.toc) : [];
  const sections = toc.map((i) => i.id);

  const nextCard = neighbours.next ? (
    <p className="text-base">
      <span className="block text-xs text-ink-muted">{t("nextUp")}</span>
      <Link
        href={lessonHref(neighbours.next)}
        className="font-serif text-lg text-accent-text underline-offset-4 hover:underline"
      >
        {neighbours.next.title}
      </Link>
    </p>
  ) : null;

  return (
    <>
      <ReadingProgress />
      <SectionTracker lessonId={lesson.id} sections={sections} />
      <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10">
        <div>
          {toc.length > 0 ? (
            <ReaderToc items={toc} minutes={lesson.estimatedMinutes} variant="side" />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            {place ? (
              <p className="font-sans text-sm text-ink-muted print:hidden">
                <Link
                  href={{ pathname: "/learn/[track]", params: { track: place.track.slug } }}
                  className="underline-offset-2 hover:underline"
                >
                  {place.track.name}
                </Link>
                {" › "}
                <Link
                  href={{
                    pathname: "/learn/[track]/[module]",
                    params: { track: place.track.slug, module: place.module.slug },
                  }}
                  className="underline-offset-2 hover:underline"
                >
                  {place.module.name}
                </Link>
              </p>
            ) : (
              <span />
            )}
            {!withBody ? null : <BookmarkButton lessonId={lesson.id} />}
          </div>
          {toc.length > 0 ? (
            <ReaderToc items={toc} minutes={lesson.estimatedMinutes} variant="top" />
          ) : null}
          <ResumeReading lessonId={lesson.id} items={toc} />

          <div id="lesson-body">
            <LessonView
              lesson={lesson}
              fallback={fallback}
              withheld={!withBody && !lesson.isStub}
            />
          </div>
          {!withBody ? null : <HighlightLayer lessonId={lesson.id} rootId="lesson-body" />}

          {lesson.relatedVideos.length > 0 ? (
            <section
              aria-labelledby="related-title"
              className="mt-12 max-w-(--measure) border-t border-rule pt-6 print:hidden"
            >
              <h2 id="related-title" className="mb-2 font-sans text-lg font-semibold text-ink">
                {t("video.related")}
              </h2>
              {/* Exercises (Phase 8) and Debunk entries (Phase 16) join this panel. */}
              <h3 className="font-sans text-sm font-semibold text-ink-muted">
                {t("video.videos")}
              </h3>
              {lesson.relatedVideos.map((v) => (
                <VideoEmbed key={v.url} url={v.url} title={v.title} />
              ))}
            </section>
          ) : null}

          {practiceCount > 0 ? (
            <p className="mt-10 max-w-(--measure) font-sans print:hidden">
              <Link
                href={{ pathname: "/practice", query: { lesson: lesson.id } }}
                className={buttonClass("primary")}
              >
                {tEx("practiceLesson", { count: practiceCount })}
              </Link>
            </p>
          ) : null}

          <section
            aria-labelledby="prereq-title"
            className="mt-10 max-w-(--measure) font-sans text-sm"
          >
            <h2
              id="prereq-title"
              className="mb-2 font-sans text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase"
            >
              {t("prerequisites")}
            </h2>
            {lesson.prerequisites.length === 0 ? (
              <p className="text-ink-muted">{t("noPrerequisites")}</p>
            ) : (
              <ul className="grid gap-1">
                {lesson.prerequisites.map((id) => {
                  const node = prerequisiteTitles[id];
                  return (
                    <li key={id}>
                      {node ? (
                        <Link
                          href={lessonHref(node)}
                          className="text-accent-text underline underline-offset-2"
                        >
                          {node.title}
                        </Link>
                      ) : (
                        id
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {!withBody ? null : <LessonNotes lessonId={lesson.id} />}
          {!withBody ? null : <CompleteLesson lessonId={lesson.id} next={nextCard} />}

          <nav
            aria-label={t("lessonNav")}
            className="mt-12 grid max-w-(--measure) grid-cols-2 gap-4 border-t border-rule pt-6 font-sans text-sm print:hidden"
          >
            <div>
              {neighbours.prev ? (
                <Link href={lessonHref(neighbours.prev)} rel="prev" className="group block">
                  <span className="block text-xs text-ink-muted">← {t("prev")}</span>
                  <span className="text-ink group-hover:underline">{neighbours.prev.title}</span>
                </Link>
              ) : null}
            </div>
            <div className="text-right">
              {neighbours.next ? (
                <Link href={lessonHref(neighbours.next)} rel="next" className="group block">
                  <span className="block text-xs text-ink-muted">{t("next")} →</span>
                  <span className="text-ink group-hover:underline">{neighbours.next.title}</span>
                </Link>
              ) : null}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
