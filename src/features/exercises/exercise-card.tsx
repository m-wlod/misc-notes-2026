"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { cx } from "@/lib/cx";

import { getHint, revealSolution, submitAttempt } from "./actions";
import type { Result, Submission } from "./grade";
import {
  ChoiceAnswer,
  CodeView,
  ExpressionAnswer,
  MultiAnswer,
  NumberAnswer,
  OpenAnswer,
  OrderingAnswer,
  SliderAnswer,
} from "./inputs";
import { recordAttempt } from "./local-attempts";
import type { PublicExercise } from "./view";

type Failure = "rate-limited" | "not-found" | "invalid" | "unreadable" | "not-gradable" | "network";

const GRADABLE = new Set([
  "numeric",
  "estimation",
  "interactive",
  "symbolic",
  "choice",
  "multi",
  "ordering",
]);

/**
 * One exercise and its whole attempt flow: answer → check (graded on the server) →
 * result → hints → solution → similar exercise. Keys: Enter checks, H hint, N next.
 * The browser never holds the answer; it only learns the grade.
 */
export function ExerciseCard({
  view,
  similarHref,
  nextHref,
}: {
  view: PublicExercise;
  /** The next variant of this exercise. */
  similarHref: string | null;
  /** The next exercise in the current practice set. */
  nextHref: string | null;
}) {
  const t = useTranslations("exercises");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "pl";
  const router = useRouter();
  const name = useId();
  const startedAt = useRef(0);
  const [pending, startTransition] = useTransition();

  const [text, setText] = useState("");
  const [slider, setSlider] = useState(() => (view.slider ? view.slider.min : 0));
  const [choice, setChoice] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>(() => view.options.map((o) => o.id));
  const [result, setResult] = useState<{ result: Result; score: number } | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [solution, setSolution] = useState<string | null>(null);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const gradable = GRADABLE.has(view.type);
  const graded = result !== null;

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

  const check = () => {
    const sub = submission();
    if (!sub || pending || graded) return;
    setFailure(null);
    startTransition(async () => {
      try {
        const res = await submitAttempt({
          exerciseId: view.id,
          variant: view.variant,
          submission: sub,
          hintsUsed: hints.length,
          timeMs: Math.max(0, Date.now() - startedAt.current),
        });
        if (!res.ok) {
          setFailure(res.reason);
          return;
        }
        setResult({ result: res.result, score: res.score });
        recordAttempt({ exerciseId: view.id, score: res.score, answer: sub });
      } catch {
        setFailure("network");
      }
    });
  };

  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  });

  const showHint = useCallback(() => {
    if (hints.length >= view.hintCount || pending) return;
    startTransition(async () => {
      const res = await getHint({
        exerciseId: view.id,
        variant: view.variant,
        index: hints.length,
        locale: lang,
      });
      if (res.ok) setHints((h) => [...h, res.html]);
      else setFailure(res.reason);
    });
  }, [hints.length, lang, pending, view.hintCount, view.id, view.variant]);

  const showSolution = () => {
    startTransition(async () => {
      const res = await revealSolution({
        exerciseId: view.id,
        variant: view.variant,
        locale: lang,
      });
      if (res.ok) setSolution(res.html);
      else setFailure(res.reason);
    });
  };

  const retry = () => {
    setResult(null);
    setFailure(null);
  };

  // Keyboard: H hint, N next (not while typing). Enter submits through the form.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el?.tagName ?? ""))
        return;
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        showHint();
      } else if ((e.key === "n" || e.key === "N") && (nextHref ?? similarHref)) {
        e.preventDefault();
        router.push(nextHref ?? similarHref ?? "");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [nextHref, router, showHint, similarHref, view.id]);

  const locked = graded || pending;
  const statusTone =
    result?.result === "correct"
      ? "border-correct"
      : result?.result === "partial"
        ? "border-accent"
        : "border-wrong";

  return (
    <article
      aria-labelledby={`${name}-title`}
      data-exercise={view.id}
      className="max-w-(--measure) rounded-md border border-rule-strong bg-surface px-5 py-5 sm:px-6"
    >
      <header className="mb-4 flex flex-wrap items-center gap-2 font-sans text-xs text-ink-muted">
        <h1 id={`${name}-title`} className="sr-only">
          {t("exercise")}
        </h1>
        <Badge>{t("level", { level: view.level })}</Badge>
        <span>{t(`types.${view.type}`)}</span>
        <span className="num">{t("minutes", { minutes: view.estimatedMinutes })}</span>
        {view.sample ? <Badge>{t("sample")}</Badge> : null}
      </header>

      <div
        className="mb-5 font-serif text-reading text-ink"
        dangerouslySetInnerHTML={{ __html: view.promptHtml }}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
        className="grid gap-4"
      >
        {view.type === "numeric" || view.type === "estimation" ? (
          <NumberAnswer value={text} onChange={setText} disabled={locked} />
        ) : view.type === "symbolic" ? (
          <ExpressionAnswer value={text} onChange={setText} disabled={locked} locale={locale} />
        ) : view.type === "interactive" && view.slider ? (
          <SliderAnswer
            value={slider}
            onChange={setSlider}
            disabled={locked}
            locale={locale}
            {...view.slider}
          />
        ) : view.type === "choice" ? (
          <ChoiceAnswer
            name={name}
            options={view.options}
            value={choice}
            onChange={setChoice}
            disabled={locked}
          />
        ) : view.type === "multi" ? (
          <MultiAnswer
            options={view.options}
            values={multi}
            onChange={setMulti}
            disabled={locked}
          />
        ) : view.type === "ordering" ? (
          <OrderingAnswer
            options={view.options}
            order={order}
            onChange={setOrder}
            disabled={locked}
          />
        ) : view.type === "code" ? (
          <CodeView starter={view.starter ?? ""} />
        ) : (
          <OpenAnswer />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {gradable && !graded ? (
            <Button type="submit" disabled={pending || submission() === null}>
              {pending ? t("checking") : t("submit")}
            </Button>
          ) : null}
          {view.hintCount > 0 ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending || hints.length >= view.hintCount}
              onClick={showHint}
            >
              {hints.length === 0
                ? t("hint")
                : t("moreHint", { left: view.hintCount - hints.length })}
            </Button>
          ) : null}
        </div>
      </form>

      <div role="status" className="mt-4 empty:hidden">
        {failure ? <p className="text-sm text-wrong">{t(`errors.${failure}`)}</p> : null}
        {result ? (
          <div className={cx("border-l-2 py-1 pl-4", statusTone)}>
            <p
              className={cx(
                "font-sans text-base font-semibold",
                result.result === "correct"
                  ? "text-correct"
                  : result.result === "wrong"
                    ? "text-wrong"
                    : "text-ink",
              )}
            >
              {result.result === "partial"
                ? t("result.partial", { percent: Math.round(result.score * 100) })
                : t(`result.${result.result}`)}
            </p>
            <p className="font-sans text-xs text-ink-muted">{t("stored")}</p>
          </div>
        ) : null}
      </div>

      {hints.length > 0 ? (
        <ol className="mt-4 grid gap-2">
          {hints.map((html, i) => (
            <li key={html} className="border-l-2 border-rule-strong pl-4 text-base">
              <span className="block font-sans text-xs text-ink-muted">
                {t("hintN", { n: i + 1, total: view.hintCount })}
              </span>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </li>
          ))}
        </ol>
      ) : null}

      {graded || !gradable ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {graded && result.result !== "correct" ? (
            <Button type="button" variant="secondary" onClick={retry}>
              {t("tryAgain")}
            </Button>
          ) : null}
          {view.hasSolution && solution === null ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={showSolution}>
              {t("showSolution")}
            </Button>
          ) : null}
          {similarHref ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                router.push(similarHref);
              }}
            >
              {t("similar")}
            </Button>
          ) : null}
          {nextHref ? (
            <Button
              type="button"
              variant={graded && result.result === "correct" ? "primary" : "secondary"}
              onClick={() => {
                router.push(nextHref);
              }}
            >
              {t("next")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {solution !== null ? (
        <section aria-label={t("solution")} className="mt-5 border-t border-rule pt-4">
          <h2 className="mb-2 font-sans text-sm font-semibold text-ink">{t("solution")}</h2>
          <div
            className="font-serif text-base text-ink"
            dangerouslySetInnerHTML={{ __html: solution }}
          />
        </section>
      ) : null}

      <p className="mt-5 hidden font-sans text-xs text-ink-muted sm:block">{t("keys")}</p>
    </article>
  );
}
