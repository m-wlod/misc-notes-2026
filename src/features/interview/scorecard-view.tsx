"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import type { Scorecard } from "./session";
import { useInterview } from "./use-interview";

/** The end of every session: score, accuracy, speed, topics to review, personal best. */
export function ScorecardView({
  card,
  sessionId,
  pnl,
  onAgain,
  children,
}: {
  card: Scorecard;
  sessionId: string;
  pnl?: number;
  onAgain: () => void;
  /** The review of every question, with full solutions. */
  children: ReactNode;
}) {
  const t = useTranslations("interview.score");
  const topic = useTranslations("interview.topics");
  const format = useFormatter();
  const saved = useInterview()?.sessions.find((s) => s.id === sessionId);
  const topics = card.review.map((r) => (topic.has(r as "add") ? topic(r as "add") : r)).join(", ");

  return (
    <section aria-labelledby="scorecard-title" className="grid gap-6">
      <div className="rounded-md border border-rule-strong bg-surface px-5 py-5">
        <h2 id="scorecard-title" className="mb-3 text-2xl">
          {t("title")}
        </h2>
        <p className="mb-3 num font-sans text-3xl font-semibold text-ink">
          {t("score", { percent: Math.round(card.score * 100) })}
        </p>
        <ul className="grid gap-1 text-base text-ink">
          <li className="num">{t("correct", { correct: card.correct, total: card.total })}</li>
          <li className="num">{t("answered", { answered: card.answered, total: card.total })}</li>
          {card.avgMs !== null ? (
            <li className="num">
              {t("avg", {
                seconds: format.number(card.avgMs / 1000, { maximumFractionDigits: 1 }),
              })}
            </li>
          ) : null}
          {pnl !== undefined ? (
            <li className="num">
              {t("pnl", {
                pnl: format.number(pnl, { maximumFractionDigits: 2, signDisplay: "exceptZero" }),
              })}
            </li>
          ) : null}
          <li>{card.review.length > 0 ? t("review", { topics }) : t("noReview")}</li>
        </ul>
        <p role="status" className="mt-3 font-sans text-sm text-ink-muted">
          {saved ? (saved.personalBest ? `${t("best")} ${t("saved")}` : t("saved")) : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={onAgain}>
            {t("again")}
          </Button>
          <Link href="/interview" className="self-center text-sm">
            {t("toHub")}
          </Link>
          <Link href="/interview/history" className="self-center text-sm">
            {t("history")}
          </Link>
        </div>
      </div>
      <section aria-labelledby="review-title">
        <h2 id="review-title" className="mb-3 text-xl">
          {t("reviewTitle")}
        </h2>
        {children}
      </section>
    </section>
  );
}
