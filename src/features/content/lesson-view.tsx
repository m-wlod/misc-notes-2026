import "katex/dist/katex.min.css";

import { getTranslations } from "next-intl/server";

import { ReadingColumn } from "@/components/content/margin-note";
import { Badge } from "@/components/ui/display";

import { DepthToggle } from "./depth-toggle";
import type { ResolvedLesson } from "./lessons";
import { MdxContent } from "./mdx-content";

/**
 * A full lesson: header (level, minutes, status), sample banner, translation-fallback
 * notice, body and sources. Used by the content preview now and the reader in Phase 6.
 */
export async function LessonView({ lesson, fallback }: ResolvedLesson) {
  const t = await getTranslations("content");
  return (
    <>
      {fallback ? (
        <p
          role="note"
          className="mb-6 max-w-(--measure) border-l-2 border-rule-strong py-2 pl-4 font-sans text-sm"
        >
          {t("fallbackNotice")}
        </p>
      ) : null}
      <article lang={lesson.locale}>
        {lesson.sample ? (
          <p
            role="note"
            className="mb-6 max-w-(--measure) border-l-2 border-accent bg-sunken py-2 pl-4 font-sans text-sm"
          >
            {t("sampleBanner")}
          </p>
        ) : null}

        <header className="mb-8 max-w-(--measure)">
          <div className="mb-3 flex flex-wrap items-center gap-2 font-sans text-sm text-ink-muted">
            <Badge>{t("lesson.level", { level: lesson.level })}</Badge>
            <span className="num">{t("lesson.minutes", { minutes: lesson.estimatedMinutes })}</span>
            {lesson.status !== "published" ? (
              <Badge>{t(`lesson.status.${lesson.status}`)}</Badge>
            ) : null}
          </div>
          <h1 className="mb-3 text-3xl">{lesson.title}</h1>
          <p className="text-base text-ink-muted">{lesson.summary}</p>
          {lesson.hasDepth ? (
            <div className="mt-5">
              <DepthToggle />
            </div>
          ) : null}
        </header>

        <ReadingColumn>
          <MdxContent code={lesson.body} />
        </ReadingColumn>

        {lesson.sources.length > 0 ? (
          <footer className="mt-12 max-w-(--measure) border-t border-rule pt-4 font-sans text-sm text-ink-muted">
            <h2 className="mb-2 text-xs font-semibold tracking-[0.08em] uppercase">
              {t("lesson.sources")}
            </h2>
            <ul>
              {lesson.sources.map((s) => (
                <li key={`${s.book}-${s.chapter ?? ""}`}>
                  {s.book}
                  {s.chapter ? `, ${t("lesson.chapter", { chapter: s.chapter })}` : ""}
                  {s.page !== undefined ? `, ${t("lesson.page", { page: String(s.page) })}` : ""}
                </li>
              ))}
            </ul>
          </footer>
        ) : null}
      </article>
    </>
  );
}
