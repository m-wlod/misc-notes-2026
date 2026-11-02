"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { reviewCard } from "./actions";
import { GRADES, type GradeName } from "./schedule";

/**
 * A review session (Phase 15): one card at a time, front → answer → how well you knew it.
 * Keys: Space shows the answer, 1–4 rate it. Each button says when the card comes back.
 * `demo` (style guide) rates locally without calling the server.
 */
export type ReviewItem = {
  cardId: string;
  kind: "definition" | "formula" | "mistake";
  /** Where the card comes from (lesson title, or the exercise). */
  source: string;
  frontHtml: string;
  backHtml: string;
  /** Mistake cards: the exercise to solve again. */
  href: string | null;
  /** When each answer would bring the card back. */
  next: Record<GradeName, string>;
};

export function ReviewSession({
  items,
  now,
  demo = false,
}: {
  items: ReviewItem[];
  now: string;
  demo?: boolean;
}) {
  const t = useTranslations("review");
  const format = useFormatter();
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [tally, setTally] = useState<Record<GradeName, number>>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const item = items[i];

  const answer = useCallback(
    (grade: GradeName) => {
      if (!item || !shown || pending) return;
      startTransition(async () => {
        const res = demo ? { ok: true } : await reviewCard({ cardId: item.cardId, grade });
        if (!res.ok) {
          setFailed(true);
          return;
        }
        setFailed(false);
        setTally((x) => ({ ...x, [grade]: x[grade] + 1 }));
        setShown(false);
        setI((n) => n + 1);
      });
    },
    [demo, item, pending, shown],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(el?.tagName ?? "")) return;
      if (e.key === " " && !shown) {
        e.preventDefault();
        setShown(true);
      } else if (shown && ["1", "2", "3", "4"].includes(e.key)) {
        answer(GRADES[Number(e.key) - 1] ?? "good");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [answer, shown]);

  if (items.length === 0) {
    return <p className="font-serif text-reading">{t("nothingDue")}</p>;
  }
  if (!item) {
    const total = items.length;
    return (
      <div data-review-done="" className="grid gap-2">
        <p className="text-xl">{t("done")}</p>
        <p className="font-sans text-sm text-ink-muted">
          {t("summary", { total, again: tally.again })}
        </p>
      </div>
    );
  }

  return (
    <div data-review-card={item.kind} className="grid max-w-(--measure) gap-4">
      <p className="font-sans text-xs text-ink-muted" aria-live="polite">
        {t("progress", { n: i + 1, total: items.length })} · {t(`kind.${item.kind}`)} ·{" "}
        {item.source}
      </p>
      <div
        className="rounded-md border border-rule-strong bg-surface px-5 py-5 font-serif text-reading"
        dangerouslySetInnerHTML={{ __html: item.frontHtml }}
      />
      {shown ? (
        <>
          <div
            data-review-back=""
            className="rounded-md border border-rule px-5 py-4 font-serif text-reading"
          >
            <div dangerouslySetInnerHTML={{ __html: item.backHtml }} />
            {item.href ? (
              <p className="mt-2 font-sans text-sm">
                <a href={item.href}>{t("solveAgain")}</a>
              </p>
            ) : null}
          </div>
          <div
            role="group"
            aria-label={t("rate")}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {GRADES.map((g, k) => (
              <Button
                key={g}
                type="button"
                variant={g === "good" ? "primary" : "secondary"}
                disabled={pending}
                onClick={() => {
                  answer(g);
                }}
                className="h-auto flex-col py-2"
              >
                <span>
                  {k + 1}. {t(`grade.${g}`)}
                </span>
                <span className="text-xs font-normal">
                  {format.relativeTime(new Date(item.next[g]), new Date(now))}
                </span>
              </Button>
            ))}
          </div>
        </>
      ) : (
        <Button
          type="button"
          className="justify-self-start"
          onClick={() => {
            setShown(true);
          }}
        >
          {t("show")}
        </Button>
      )}
      {failed ? (
        <p role="alert" className="font-sans text-sm text-wrong">
          {t("saveFailed")}
        </p>
      ) : null}
      <p className="hidden font-sans text-xs text-ink-muted sm:block">{t("keys")}</p>
    </div>
  );
}
