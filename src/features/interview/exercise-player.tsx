"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { OpenPanel } from "@/features/ai-grading/open-panel";
import { revealSolution, submitAttempt } from "@/features/exercises/actions";
import type { Submission } from "@/features/exercises/grade";
import {
  ChoiceAnswer,
  ExpressionAnswer,
  MultiAnswer,
  NumberAnswer,
  OrderingAnswer,
  SliderAnswer,
} from "@/features/exercises/inputs";
import { recordAttempt } from "@/features/exercises/local-attempts";
import type { PublicExercise } from "@/features/exercises/view";
import { cx } from "@/lib/cx";

import { kindInfo } from "./kinds";
import { LevelSetup } from "./level-setup";
import { pickQuestions } from "./pool";
import { newSeed, useSessionRunner } from "./runner";
import { ScorecardView } from "./scorecard-view";
import { remainingMs, scorecard, type SessionKind } from "./session";
import { Timer } from "./timer";

/**
 * Exercise-based interview sessions (Phase 11b): the probability sprint (auto-graded on
 * the server, no feedback until the end) and brainteasers / the modelling question
 * (open answers: AI grade when on, otherwise the self-check). The browser only ever has
 * public views; grading and solutions come from server actions.
 */
export function ExercisePlayer({
  kind,
  pool,
  aiAvailable,
}: {
  kind: Extract<SessionKind, "probability_sprint" | "brainteasers" | "open_modelling">;
  pool: readonly PublicExercise[];
  aiAvailable: boolean;
}) {
  const t = useTranslations("interview");
  const info = kindInfo(kind);
  const run = useSessionRunner<PublicExercise>(kind);
  const { session } = run;

  if (!session) {
    if (pool.length === 0) return <p className="text-base text-ink-muted">{t("pool.empty")}</p>;
    return (
      <LevelSetup
        kind={kind}
        rules={`${t(`setup.rules.${kind}`)}${pool.length < info.size ? ` ${t("pool.short", { count: pool.length, size: info.size })}` : ""}`}
        onStart={(level) => {
          const seed = newSeed();
          run.start({
            level,
            seed,
            questions: pickQuestions(pool, level, info.size, seed),
            durationMs: info.minutes * 60_000,
          });
        }}
      />
    );
  }

  if (session.status === "finished") {
    return (
      <ScorecardView card={scorecard(session)} sessionId={run.id} onAgain={run.reset}>
        <ol className="grid gap-6">
          {session.questions.map((q, i) => (
            <ReviewItem
              key={q.id}
              view={q}
              n={i + 1}
              total={session.questions.length}
              answer={session.answers[i]}
            />
          ))}
        </ol>
      </ScorecardView>
    );
  }

  const current = session.questions[session.index];
  if (!current) return null;
  return (
    <div className="grid max-w-(--measure) gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="num font-sans text-sm text-ink-muted">
          {t("pool.question", { n: session.index + 1, total: session.questions.length })}
        </p>
        <Timer remaining={remainingMs(session, run.now)} />
      </div>
      <div
        className="font-serif text-reading text-ink"
        dangerouslySetInnerHTML={{ __html: current.promptHtml }}
      />
      {current.type === "open" || current.type === "brainteaser" ? (
        <OpenQuestion
          key={current.id}
          view={current}
          aiAvailable={aiAvailable}
          onNext={(score, given) => {
            run.answer({ questionId: current.id, given, score, topic: current.topics[0] ?? "" });
          }}
        />
      ) : (
        <GradedQuestion
          key={current.id}
          view={current}
          onGraded={(score, given) => {
            run.answer({ questionId: current.id, given, score, topic: current.topics[0] ?? "" });
          }}
        />
      )}
      <div>
        <Button type="button" variant="ghost" onClick={run.finish}>
          {t("player.finish")}
        </Button>
      </div>
    </div>
  );
}

/** Sprint question: answer, graded on the server, then straight on (no feedback yet). */
function GradedQuestion({
  view,
  onGraded,
}: {
  view: PublicExercise;
  onGraded: (score: number, given: string) => void;
}) {
  const t = useTranslations("exercises");
  const locale = useLocale();
  const name = useId();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [slider, setSlider] = useState(view.slider?.min ?? 0);
  const [choice, setChoice] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>(() => view.options.map((o) => o.id));
  const [shownAt] = useState(() => Date.now());

  const submission = (): Submission | null => {
    switch (view.type) {
      case "numeric":
      case "estimation":
      case "symbolic":
        return text.trim() ? { kind: "text", value: text } : null;
      case "interactive":
        return { kind: "number", value: slider };
      case "choice":
        return choice ? { kind: "choice", value: choice } : null;
      case "multi":
        return multi.length > 0 ? { kind: "multi", values: multi } : null;
      case "ordering":
        return { kind: "order", values: order };
      default:
        return null;
    }
  };
  const given = (sub: Submission) => ("value" in sub ? String(sub.value) : sub.values.join(", "));

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const sub = submission();
        if (!sub || pending) return;
        setFailure(null);
        startTransition(async () => {
          const res = await submitAttempt({
            exerciseId: view.id,
            variant: view.variant,
            submission: sub,
            locale,
            hintsUsed: 0,
            timeMs: Math.max(0, Date.now() - shownAt),
          }).catch(() => null);
          if (!res) {
            setFailure("network");
            return;
          }
          if (!res.ok) {
            setFailure(res.reason);
            return;
          }
          recordAttempt({ exerciseId: view.id, score: res.score, answer: sub });
          onGraded(res.score, given(sub));
        });
      }}
    >
      {view.type === "numeric" || view.type === "estimation" ? (
        <NumberAnswer value={text} onChange={setText} disabled={pending} />
      ) : view.type === "symbolic" ? (
        <ExpressionAnswer value={text} onChange={setText} disabled={pending} locale={locale} />
      ) : view.type === "interactive" && view.slider ? (
        <SliderAnswer
          value={slider}
          onChange={setSlider}
          disabled={pending}
          locale={locale}
          {...view.slider}
        />
      ) : view.type === "choice" ? (
        <ChoiceAnswer
          name={name}
          options={view.options}
          value={choice}
          onChange={setChoice}
          disabled={pending}
        />
      ) : view.type === "multi" ? (
        <MultiAnswer options={view.options} values={multi} onChange={setMulti} disabled={pending} />
      ) : view.type === "ordering" ? (
        <OrderingAnswer
          options={view.options}
          order={order}
          onChange={setOrder}
          disabled={pending}
        />
      ) : null}
      <div role="status" className="empty:hidden">
        {failure ? (
          <p className="text-sm text-wrong">{t(`errors.${failure as "invalid"}`)}</p>
        ) : null}
      </div>
      <div>
        <Button type="submit" disabled={pending || submission() === null}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}

/** Brainteaser or modelling question: the open-answer panel, then "next". */
function OpenQuestion({
  view,
  aiAvailable,
  onNext,
}: {
  view: PublicExercise;
  aiAvailable: boolean;
  onNext: (score: number, given: string) => void;
}) {
  const t = useTranslations("interview");
  const lang = useLocale() === "en" ? "en" : "pl";
  const [result, setResult] = useState<{ score: number; given: string } | null>(null);
  return (
    <div className="grid gap-4">
      <OpenPanel
        exerciseId={view.id}
        version={view.variant}
        lang={lang}
        aiAvailable={aiAvailable}
        followUp={aiAvailable}
        onResult={(r) => {
          setResult({ score: r.score, given: r.given });
        }}
      />
      {result ? (
        <div>
          <Button
            type="button"
            onClick={() => {
              onNext(result.score, result.given);
            }}
          >
            {t("player.next")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Review mode: the question, the learner's answer and score, and the full solution. */
function ReviewItem({
  view,
  n,
  total,
  answer,
}: {
  view: PublicExercise;
  n: number;
  total: number;
  answer: { given: string; score: number } | undefined;
}) {
  const t = useTranslations("interview");
  const locale = useLocale();
  const [solution, setSolution] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <li
      className={cx(
        "border-l-2 py-1 pl-4",
        answer === undefined
          ? "border-rule-strong"
          : answer.score >= 1
            ? "border-correct"
            : answer.score > 0
              ? "border-accent"
              : "border-wrong",
      )}
    >
      <p className="mb-1 font-sans text-xs text-ink-muted">{t("pool.question", { n, total })}</p>
      <div
        className="mb-2 font-serif text-base text-ink"
        dangerouslySetInnerHTML={{ __html: view.promptHtml }}
      />
      <p className="num font-sans text-sm text-ink">
        {t("score.yourAnswer", { given: answer?.given || t("score.skipped") })}
        {answer ? ` · ${String(Math.round(answer.score * 100))}%` : ""}
      </p>
      {view.hasSolution ? (
        solution === null ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-1"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await revealSolution({
                  exerciseId: view.id,
                  variant: view.variant,
                  locale,
                }).catch(() => null);
                if (res?.ok) setSolution(res.html);
              });
            }}
          >
            {t("pool.solution")}
          </Button>
        ) : (
          <div
            className="mt-2 font-serif text-base text-ink"
            dangerouslySetInnerHTML={{ __html: solution }}
          />
        )
      ) : null}
    </li>
  );
}
