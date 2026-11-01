"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { cx } from "@/lib/cx";

import { isCorrect, toCheck, type CheckProps } from "./check-yourself-rules";

/**
 * An ungraded question between sections: instant feedback, nothing stored, no XP. The
 * only place an answer may live in the browser (CLAUDE.md grading rule). The question
 * is the children (MDX, so math works); options and explanation are plain text.
 */
export function CheckYourself({ children, ...props }: CheckProps & { children?: ReactNode }) {
  const check = toCheck(props); // throws on broken props → fails the page build
  const t = useTranslations("reader.check");
  const invalid = useTranslations("placement.invalid");
  const name = useId();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [revealed, setRevealed] = useState(false);

  const answerText = check.kind === "choice" ? (check.options[check.correct] ?? "") : check.display;

  return (
    // A group named by its own question: several of these on a page must not be
    // identical landmarks (axe landmark-unique).
    <div
      role="group"
      aria-labelledby={`${name}-question`}
      className="my-8 rounded-md border border-rule-strong bg-surface px-5 py-4 font-sans print:hidden"
    >
      <p
        id={`${name}-label`}
        className="mb-2 text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase"
      >
        {t("label")}
      </p>
      <div
        id={`${name}-question`}
        className="mb-3 font-serif text-reading text-ink [&>:last-child]:mb-0"
      >
        {children}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setResult(isCorrect(check, value) ? "correct" : "wrong");
        }}
        className="grid gap-3"
      >
        {check.kind === "choice" ? (
          <fieldset className="grid gap-1.5">
            <legend className="sr-only">{t("yourAnswer")}</legend>
            {check.options.map((option, i) => (
              <label key={option} className="flex items-center gap-2 text-base text-ink">
                <input
                  type="radio"
                  name={name}
                  value={String(i)}
                  checked={value === String(i)}
                  onChange={() => {
                    setValue(String(i));
                    setResult(null);
                  }}
                  className="size-4 accent-(--accent)"
                />
                {option}
              </label>
            ))}
          </fieldset>
        ) : (
          <label className="grid max-w-xs gap-1 text-sm text-ink">
            {t("yourAnswer")}
            <NumberInput
              value={value}
              invalidMessage={(reason) => invalid(reason)}
              onValueChange={(raw) => {
                setValue(raw);
                setResult(null);
              }}
            />
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={value.trim() === ""}>
            {t("submit")}
          </Button>
          {result === "wrong" && !revealed ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setRevealed(true);
              }}
            >
              {t("reveal")}
            </Button>
          ) : null}
        </div>
      </form>
      <div role="status" className="mt-3 text-sm">
        {result ? (
          <p className={cx("font-semibold", result === "correct" ? "text-correct" : "text-wrong")}>
            {result === "correct" ? t("correct") : t("wrong")}
          </p>
        ) : null}
        {result === "correct" || revealed ? (
          <>
            <p className="mt-1 text-ink">{t("answer", { answer: answerText })}</p>
            {props.explanation ? <p className="mt-1 text-ink-muted">{props.explanation}</p> : null}
          </>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-ink-muted">{t("note")}</p>
    </div>
  );
}
