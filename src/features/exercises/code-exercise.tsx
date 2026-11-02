"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { getRuntime } from "@/features/python/client";
import { OutputPanel } from "@/features/python/output-panel";
import type { RunOutput } from "@/features/python/protocol";
import { runSuite, type TestOutcome } from "@/features/python/run-tests";
import { useRun, useRuntimeState } from "@/features/python/use-run";
import { cx } from "@/lib/cx";

import { getCodeTests, submitAttempt } from "./actions";
import type { Result, Submission } from "./grade";
import { NumberAnswer } from "./inputs";
import type { PublicExercise } from "./view";

const CodeEditor = dynamic(
  () => import("@/features/python/code-editor").then((m) => m.CodeEditor),
  { ssr: false },
);

/** `answer` is what the local attempt stores (the submission, plus the learner's own code). */
export type CodeGrade = { result: Result; score: number; answer: Submission & { code?: string } };
type Failure = "rate-limited" | "not-found" | "invalid" | "unreadable" | "not-gradable" | "network";

/**
 * A code exercise (Phase 13): edit and run the code, run the visible examples, then
 * "Check" fetches the hidden tests, runs each against the code in the browser and sends
 * the counts plus the computed number to the server, which grades. Exercises with a final
 * number also take just that number, for people who solve them in their own tools.
 */
export function CodeExercise({
  view,
  lang,
  locked,
  onGraded,
  onFailure,
  meta,
}: {
  view: PublicExercise & { code: NonNullable<PublicExercise["code"]> };
  lang: "pl" | "en";
  locked: boolean;
  onGraded: (grade: CodeGrade) => void;
  onFailure: (reason: Failure) => void;
  meta: () => { hintsUsed: number; timeMs: number };
}) {
  const t = useTranslations("exercises.code");
  const tp = useTranslations("python");
  const ns = `exercise:${view.id}`;
  const code = useRef(view.code.starter);
  const { output, run, stop } = useRun(ns);
  const runtime = useRuntimeState();
  const [suite, setSuite] = useState<
    | { kind: "running"; done: number; total: number }
    | { kind: "setup-error"; output: RunOutput }
    | { kind: "done"; outcomes: TestOutcome[] }
    | null
  >(null);
  const [answer, setAnswer] = useState("");
  const [ownCode, setOwnCode] = useState("");
  const [pending, startTransition] = useTransition();
  const ownId = useId();

  const send = (submission: Submission) =>
    submitAttempt({
      exerciseId: view.id,
      variant: view.variant,
      submission,
      locale: lang,
      ...meta(),
    });

  const check = () => {
    if (locked || suite?.kind === "running") return;
    startTransition(async () => {
      try {
        const tests = await getCodeTests({ exerciseId: view.id, locale: lang });
        if (!tests.ok) {
          onFailure(tests.reason === "percent-not-allowed" ? "invalid" : tests.reason);
          return;
        }
        setSuite({ kind: "running", done: 0, total: tests.tests.length });
        const res = await runSuite(code.current, tests.tests, tests.answerExpr, {
          ns,
          lang,
          onProgress: (done) => {
            setSuite({ kind: "running", done, total: tests.tests.length });
          },
        });
        if (res.kind === "setup-error") {
          setSuite(res);
          return;
        }
        setSuite({ kind: "done", outcomes: res.outcomes });
        const submission: Submission = {
          kind: "code",
          passed: res.outcomes.filter((o) => o.passed).length,
          total: res.outcomes.length,
          value: res.value,
        };
        const graded = await send(submission);
        if (graded.ok) onGraded({ result: graded.result, score: graded.score, answer: submission });
        else onFailure(graded.reason === "percent-not-allowed" ? "invalid" : graded.reason);
      } catch {
        onFailure("network");
      }
    });
  };

  const submitAnswer = () => {
    if (locked || !answer.trim()) return;
    startTransition(async () => {
      try {
        const submission: Submission = { kind: "text", value: answer };
        const graded = await send(submission);
        if (graded.ok) {
          // The learner's own code is kept with the local attempt only, for reference.
          onGraded({
            result: graded.result,
            score: graded.score,
            answer: ownCode.trim() ? { ...submission, code: ownCode.slice(0, 20_000) } : submission,
          });
        } else onFailure(graded.reason === "percent-not-allowed" ? "unreadable" : graded.reason);
      } catch {
        onFailure("network");
      }
    });
  };

  const running = suite?.kind === "running" || pending;
  const busy =
    output?.status === "queued" || output?.status === "loading" || output?.status === "running";

  return (
    <div data-code-exercise="" className="grid gap-3">
      <CodeEditor
        initial={view.code.starter}
        label={t("label")}
        onChange={(c) => {
          code.current = c;
        }}
        onRun={() => void run(code.current)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy || running}
          onClick={() => void run(code.current)}
        >
          {tp("run")}
        </Button>
        {view.code.examples.trim() ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || running}
            onClick={() => void run(`${code.current}\n\n${view.code.examples}`)}
          >
            {t("runExamples")}
          </Button>
        ) : null}
        <Button type="button" size="sm" disabled={locked || running || busy} onClick={check}>
          {running ? t("checking") : t("check", { count: view.code.testCount })}
        </Button>
      </div>
      {view.code.examples.trim() ? (
        <details className="font-sans text-sm">
          <summary className="cursor-pointer text-ink-muted">{t("examples")}</summary>
          <pre className="mt-1 overflow-x-auto rounded-sm bg-sunken px-3 py-2 font-mono text-xs">
            {view.code.examples}
          </pre>
        </details>
      ) : null}
      <OutputPanel output={output} runtime={runtime} onStop={stop} />

      <div aria-live="polite" className="empty:hidden">
        {suite?.kind === "running" ? (
          <p className="font-sans text-sm text-ink-muted">
            {suite.done === 0 && runtime.phase !== "ready"
              ? tp("status.runtime")
              : t("progress", { done: suite.done, total: suite.total })}
          </p>
        ) : null}
        {suite?.kind === "setup-error" ? (
          <div data-setup-error="">
            <p className="font-sans text-sm text-wrong">
              {suite.output.stopped === "timeout" ? tp("status.timeout") : t("setupError")}
            </p>
            {suite.output.error ? (
              <pre className="mt-1 overflow-x-auto rounded-sm border border-wrong/50 px-3 py-2 font-mono text-xs whitespace-pre-wrap text-wrong">
                {suite.output.error}
              </pre>
            ) : null}
          </div>
        ) : null}
        {suite?.kind === "done" ? (
          <ol data-tests="" className="grid gap-1.5 font-sans text-sm">
            {suite.outcomes.map((o, i) => (
              <li
                key={i}
                data-test-result={o.passed ? "pass" : "fail"}
                className={cx("border-l-2 pl-3", o.passed ? "border-correct" : "border-wrong")}
              >
                <span className={o.passed ? "text-correct" : "text-wrong"}>
                  {o.passed ? t("pass", { n: i + 1 }) : t("fail", { n: i + 1 })}
                </span>
                {o.passed ? null : (
                  <>
                    <span className="block text-ink">{o.message}</span>
                    {o.timedOut ? (
                      <span className="block text-xs text-ink-muted">{t("testTimeout")}</span>
                    ) : null}
                    {o.detail ? (
                      <code className="block font-mono text-xs text-ink-muted">{o.detail}</code>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {view.code.answerOnly || view.code.dataset ? (
        <section
          aria-labelledby={`${ownId}-byo`}
          className="mt-2 rounded-sm border border-rule px-4 py-3"
        >
          <h2 id={`${ownId}-byo`} className="mb-1 font-sans text-sm font-semibold text-ink">
            {t("byo.title")}
          </h2>
          <p className="mb-2 font-sans text-sm text-ink-muted">{t("byo.lead")}</p>
          {view.code.dataset ? (
            <p className="mb-3 font-sans text-sm">
              <a href={`/datasets/${view.code.dataset}.csv`} download data-dataset-link="">
                {t("byo.download", { name: view.code.dataset })}
              </a>
            </p>
          ) : null}
          {view.code.answerOnly ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAnswer();
              }}
              className="grid gap-3"
            >
              <NumberAnswer value={answer} onChange={setAnswer} disabled={locked || pending} />
              <div className="grid gap-1.5">
                <label htmlFor={`${ownId}-code`} className="font-sans text-sm text-ink">
                  {t("byo.ownCode")}
                </label>
                <textarea
                  id={`${ownId}-code`}
                  rows={4}
                  value={ownCode}
                  onChange={(e) => {
                    setOwnCode(e.target.value);
                  }}
                  disabled={locked || pending}
                  className="rounded border border-rule-strong bg-surface px-3 py-2 font-mono text-sm text-ink"
                />
                <p className="font-sans text-xs text-ink-muted">{t("byo.ownCodeNote")}</p>
              </div>
              <div>
                <Button type="submit" size="sm" disabled={locked || pending || !answer.trim()}>
                  {t("byo.submit")}
                </Button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
      {runtime.phase === "failed" ? (
        <p className="font-sans text-sm text-wrong">
          {tp("status.failed")}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              getRuntime().restart();
            }}
          >
            {tp("notebook.restart")}
          </button>
        </p>
      ) : null}
    </div>
  );
}
