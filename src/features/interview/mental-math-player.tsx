"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";

import { LevelSetup } from "./level-setup";
import { checkMental, generateMentalMath, MENTAL_MATH, type MathQuestion } from "./mental-math";
import { newSeed, useSessionRunner } from "./runner";
import { ScorecardView } from "./scorecard-view";
import { remainingMs, scorecard } from "./session";
import { Timer } from "./timer";

/** How a question reads, formatted for the locale (decimal comma in Polish). */
export function useMathText() {
  const t = useTranslations("interview.player");
  const format = useFormatter();
  const n = (v: number) => format.number(v, { maximumFractionDigits: 6 });
  return (q: MathQuestion) =>
    q.op === "%"
      ? `${n(q.a)}% ${t("of")} ${n(q.b)}`
      : q.op === "/"
        ? `${n(q.a)}/${n(q.b)} ${t("asDecimal")}`
        : `${n(q.a)} ${q.op} ${n(q.b)}`;
}

export function MentalMathPlayer() {
  const t = useTranslations("interview");
  const format = useFormatter();
  const text = useMathText();
  const run = useSessionRunner<MathQuestion>("mental_math");
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { session } = run;
  const current = session?.status === "running" ? session.questions[session.index] : undefined;

  // Keep the cursor in the field from one question to the next.
  useEffect(() => {
    input.current?.focus();
  }, [current?.id]);

  if (!session) {
    return (
      <LevelSetup
        kind="mental_math"
        rules={t("setup.rulesMental")}
        onStart={(level) => {
          const seed = newSeed();
          run.start({
            level,
            seed,
            questions: generateMentalMath(level, seed),
            durationMs: MENTAL_MATH.durationMs,
          });
        }}
      />
    );
  }

  if (session.status === "finished") {
    const card = scorecard(session);
    return (
      <ScorecardView
        card={card}
        sessionId={run.id}
        onAgain={() => {
          setValue("");
          run.reset();
        }}
      >
        <ol className="grid gap-1 font-sans text-sm sm:grid-cols-2">
          {session.questions.map((q, i) => {
            const a = session.answers[i];
            return (
              <li
                key={q.id}
                className={cx(
                  "border-l-2 py-0.5 pl-3 num",
                  a?.score === 1 ? "border-correct" : "border-wrong",
                )}
              >
                {text(q)} = {format.number(q.answer, { maximumFractionDigits: 6 })}
                {a?.score === 1 ? null : (
                  <span className="text-ink-muted">
                    {" · "}
                    {t("score.yourAnswer", { given: a?.given || t("score.skipped") })}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </ScorecardView>
    );
  }

  if (!current) return null;
  return (
    <div className="grid max-w-(--measure) gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="num font-sans text-sm text-ink-muted">
          {t("player.question", { n: session.index + 1, total: session.questions.length })}
        </p>
        <Timer remaining={remainingMs(session, run.now)} />
      </div>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run.answer({
            questionId: current.id,
            given: value.trim(),
            score: checkMental(value, current) ? 1 : 0,
            topic: current.topic,
          });
          setValue("");
        }}
      >
        <label htmlFor="mm-answer" className="num font-serif text-3xl text-ink">
          {text(current)} =
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            id="mm-answer"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
            }}
            className="w-40 rounded border border-rule-strong bg-surface px-3 py-2 num text-xl text-ink"
          />
          <Button type="submit">{t("player.next")}</Button>
          <Button type="button" variant="ghost" onClick={run.finish}>
            {t("player.finish")}
          </Button>
        </div>
      </form>
    </div>
  );
}
