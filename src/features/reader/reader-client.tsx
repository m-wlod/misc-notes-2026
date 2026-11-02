"use client";

import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useLocalProgress } from "@/features/curriculum/use-local-progress";
import { celebrate } from "@/features/gamification/celebrate";
import { completeLesson } from "@/features/progress/actions";
import { cx } from "@/lib/cx";

import {
  minutesLeft,
  parseReading,
  READING_KEY,
  setLessonStatus,
  store,
  withSection,
} from "./storage";

/**
 * Client parts of the lesson reader. One small store holds the active section and how
 * far the article has been read; the bar, the table of contents and the tracker share it.
 */

export type TocItem = { id: string; title: string; depth: 2 | 3 };

type ReaderState = { active: string | null; fraction: number };
let state: ReaderState = { active: null, fraction: 0 };
const listeners = new Set<() => void>();
function set(next: Partial<ReaderState>) {
  const merged = { ...state, ...next };
  if (merged.active === state.active && merged.fraction === state.fraction) return;
  state = merged;
  for (const l of listeners) l();
}
function useReaderState(): ReaderState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

const ARTICLE = "lesson-body";

/**
 * Watches the article: which section is on screen, how far it has been read, and
 * records "in progress" plus the furthest section in this browser.
 */
export function SectionTracker({ lessonId, sections }: { lessonId: string; sections: string[] }) {
  useEffect(() => {
    const article = document.getElementById(ARTICLE);
    if (!article) return;
    const headings = sections
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    let frame = 0;
    let recorded: string | null = null;

    // On every scroll frame (a handful of headings, so cheap). IntersectionObserver alone
    // misses headings that a fast scroll jumps straight past.
    const update = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const rect = article.getBoundingClientRect();
      // 0 while the article's top is still on screen, 1 once its end reaches the bottom.
      const scrollable = rect.height - viewport;
      const fraction =
        scrollable > 0
          ? Math.min(1, Math.max(0, -rect.top / scrollable))
          : rect.bottom <= viewport
            ? 1
            : 0;
      // The last heading above the upper third of the screen is the current section.
      const current =
        headings.filter((h) => h.getBoundingClientRect().top < viewport / 3).at(-1)?.id ?? null;
      set({ fraction, active: current });
      if (current && current !== recorded) {
        recorded = current;
        setLessonStatus(lessonId, "in_progress");
        store(READING_KEY, (raw) => withSection(raw, lessonId, current, sections, new Date()));
      }
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      set({ active: null, fraction: 0 });
    };
  }, [lessonId, sections]);
  return null;
}

/** Thin bar under the top bar. Purely visual; the time left is the text equivalent. */
export function ReadingProgress() {
  const t = useTranslations("reader");
  const { fraction } = useReaderState();
  return (
    <div
      role="progressbar"
      aria-label={t("progress")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      className="fixed inset-x-0 top-0 z-(--z-sticky) h-0.5 bg-transparent print:hidden"
    >
      <div
        className="h-full origin-left bg-accent"
        style={{ transform: `scaleX(${String(fraction)})` }}
      />
    </div>
  );
}

export function TimeLeft({ minutes }: { minutes: number }) {
  const t = useTranslations("reader");
  const { fraction } = useReaderState();
  const left = minutesLeft(minutes, fraction);
  return (
    <p className="num text-xs text-ink-muted" data-testid="time-left">
      {left === 0 ? t("timeDone") : t("timeLeft", { minutes: left })}
    </p>
  );
}

/** Table of contents: sticky beside the text on wide screens, collapsible above it on phones. */
export function ReaderToc({
  items,
  minutes,
  variant,
}: {
  items: readonly TocItem[];
  minutes: number;
  variant: "side" | "top";
}) {
  const t = useTranslations("reader");
  const { active } = useReaderState();
  const list = (
    <ol className="grid gap-1.5">
      {items.map((item) => (
        <li key={item.id} className={item.depth === 3 ? "pl-3" : undefined}>
          <a
            href={`#${item.id}`}
            aria-current={active === item.id ? "location" : undefined}
            className={cx(
              "block border-l-2 py-0.5 pl-3 text-sm leading-snug",
              active === item.id
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {item.title}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "top") {
    return (
      <details className="mb-8 rounded-md border border-rule-strong px-4 py-3 font-sans lg:hidden print:hidden">
        <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-ink">
          {t("toc")}
          <TimeLeft minutes={minutes} />
        </summary>
        <nav aria-label={t("toc")} className="mt-3">
          {list}
        </nav>
      </details>
    );
  }
  return (
    <nav aria-label={t("toc")} className="sticky top-24 hidden font-sans lg:block print:hidden">
      <p className="mb-3 text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
        {t("toc")}
      </p>
      {list}
      <div className="mt-4">
        <TimeLeft minutes={minutes} />
      </div>
    </nav>
  );
}

/** "Back to where you left off" when the reader stopped past the first section. */
export function ResumeReading({
  lessonId,
  items,
}: {
  lessonId: string;
  items: readonly TocItem[];
}) {
  const t = useTranslations("reader");
  // Read once per render from storage; null on the server (nothing to offer there).
  const raw = useSyncExternalStore(subscribeStorage, readReadingRaw, () => null);
  const id = raw === null ? undefined : parseReading(raw).lessons[lessonId]?.section;
  const section = items.find((i) => i.id === id);
  // Only worth offering beyond the first section.
  if (!section || items.indexOf(section) === 0) return null;
  return (
    <p className="mb-6 font-sans text-sm print:hidden">
      <a href={`#${section.id}`} className="text-accent-text underline underline-offset-2">
        {t("resume", { section: section.title })}
      </a>
    </p>
  );
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
  };
}
function readReadingRaw(): string | null {
  try {
    return localStorage.getItem(READING_KEY) ?? "";
  } catch {
    return "";
  }
}

/** "Mark as understood" at the end, then the next lesson. TODO(phase-14): award XP here. */
export function CompleteLesson({ lessonId, next }: { lessonId: string; next: ReactNode }) {
  const t = useTranslations("reader");
  const statuses = useLocalProgress();
  const status = statuses?.get(lessonId);
  const done = status === "completed" || status === "mastered";

  return (
    <section
      aria-labelledby="complete-title"
      className="mt-12 max-w-(--measure) border-t border-rule pt-6 font-sans print:hidden"
    >
      {done ? (
        <div role="status">
          <p id="complete-title" className="text-lg font-semibold text-ink">
            {t("completed")}
          </p>
          <p className="mb-4 text-sm text-ink-muted">{t("completedNote")}</p>
          {next}
        </div>
      ) : (
        <>
          <h2 id="complete-title" className="sr-only">
            {t("complete")}
          </h2>
          <Button
            disabled={statuses === null}
            onClick={() => {
              setLessonStatus(lessonId, "completed");
              // Signed in: on the account too, with XP (Phase 14). Signed out: no-op.
              void completeLesson({ lessonId })
                .then((r) => {
                  celebrate(r.rewards);
                })
                .catch(() => undefined);
            }}
          >
            {t("complete")}
          </Button>
        </>
      )}
    </section>
  );
}
