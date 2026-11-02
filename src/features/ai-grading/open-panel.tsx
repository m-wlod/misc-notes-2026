"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FieldHint, Label, Textarea } from "@/components/ui/field";
import { recordAttempt } from "@/features/exercises/local-attempts";
import type { AiGrade } from "@/lib/ai/grade-schema";
import { cx } from "@/lib/cx";

import { reportUnfairGrade, revealSelfCheck } from "./actions";

/**
 * Open and brainteaser exercises (Phase 10). With AI grading on (a key and accounts):
 * a rubric-based grade out of 4 with feedback, and a way to report an unfair one.
 * Otherwise, or when the quota is used up: compare with the reference solution and tick
 * the rubric items the answer covers (a self-assessment, stored in this browser).
 */
export const MAX_WORDS = 1500;
/** Server-rendered text (KaTeX, escaped plain text). */
const rich = (html: string) => <span dangerouslySetInnerHTML={{ __html: html }} />;
const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

type AiFailure =
  "unauthorized" | "not-configured" | "user-quota" | "budget" | "ip-limit" | "fallback" | "network";

type Graded = { grade: AiGrade; attemptId: number | null };
type SelfCheck = { solutionHtml: string | null; rubricHtml: string[] };

export function OpenPanel({
  exerciseId,
  version,
  lang,
  aiAvailable,
  onResult,
  followUp = false,
}: {
  exerciseId: string;
  version: number;
  lang: "pl" | "en";
  aiAvailable: boolean;
  /** Called once with the result (AI grade or self-assessment), e.g. by an interview session. */
  onResult?: (r: { score: number; given: string; graded: "ai" | "self" }) => void;
  /** Offer the interviewer's follow-up question after an AI grade (Phase 11). */
  followUp?: boolean;
}) {
  const t = useTranslations("exercises.open");
  const id = useId();
  const [answer, setAnswer] = useState("");
  const [pending, startTransition] = useTransition();
  const [graded, setGraded] = useState<Graded | null>(null);
  const [failure, setFailure] = useState<AiFailure | null>(null);
  const [selfCheck, setSelfCheck] = useState<SelfCheck | null>(null);
  const [ticked, setTicked] = useState<number[]>([]);
  const [savedSelf, setSavedSelf] = useState(false);

  const words = countWords(answer);
  const tooLong = words > MAX_WORDS;
  const empty = words === 0;

  const openSelfCheck = () => {
    startTransition(async () => {
      const res = await revealSelfCheck({ exerciseId, version, locale: lang }).catch(() => null);
      if (res?.ok) setSelfCheck({ solutionHtml: res.solutionHtml, rubricHtml: res.rubricHtml });
      else setFailure("network");
    });
  };

  const gradeWithAi = () => {
    if (empty || tooLong || pending) return;
    setFailure(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/grade/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exerciseId, version, locale: lang, answer }),
        });
        const body = (await res.json()) as
          { ok: true; grade: AiGrade; attemptId: number | null } | { error: AiFailure };
        if ("grade" in body) {
          setGraded({ grade: body.grade, attemptId: body.attemptId });
          onResult?.({ score: body.grade.score / 4, given: answer, graded: "ai" });
          recordAttempt({
            exerciseId,
            score: body.grade.score / 4,
            answer: { kind: "ai", value: answer },
          });
        } else {
          setFailure(body.error);
          // Whatever went wrong, the exercise stays useful.
          openSelfCheck();
        }
      } catch {
        setFailure("network");
      }
    });
  };

  const saveSelfAssessment = () => {
    if (!selfCheck) return;
    recordAttempt({
      exerciseId,
      score: ticked.length / Math.max(1, selfCheck.rubricHtml.length),
      answer: { kind: "self", value: answer, ticked },
    });
    setSavedSelf(true);
    onResult?.({
      score: ticked.length / Math.max(1, selfCheck.rubricHtml.length),
      given: answer,
      graded: "self",
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{t("label")}</Label>
        <Textarea
          id={id}
          rows={6}
          value={answer}
          aria-describedby={`${id}-count`}
          aria-invalid={tooLong || undefined}
          disabled={graded !== null}
          onChange={(e) => {
            setAnswer(e.target.value);
          }}
        />
        <FieldHint id={`${id}-count`} className={cx("num", tooLong && "text-wrong")}>
          {tooLong
            ? t("tooLong", { max: MAX_WORDS })
            : t("words", { count: words, max: MAX_WORDS })}
        </FieldHint>
      </div>

      {graded === null ? (
        <div className="flex flex-wrap items-center gap-2">
          {aiAvailable ? (
            <Button type="button" disabled={empty || tooLong || pending} onClick={gradeWithAi}>
              {pending ? t("grading") : t("grade")}
            </Button>
          ) : null}
          {selfCheck === null ? (
            <Button
              type="button"
              variant={aiAvailable ? "secondary" : "primary"}
              disabled={pending}
              onClick={openSelfCheck}
            >
              {t("selfCheck")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div role="status" className="empty:hidden">
        {!aiAvailable && selfCheck === null ? (
          <p className="text-sm text-ink-muted">{t("aiOff")}</p>
        ) : null}
        {failure ? <p className="text-sm text-wrong">{t(`errors.${failure}`)}</p> : null}
      </div>

      {graded ? <AiResult graded={graded} /> : null}
      {graded && followUp ? (
        <FollowUp exerciseId={exerciseId} version={version} lang={lang} answer={answer} />
      ) : null}

      {selfCheck ? (
        <section aria-labelledby={`${id}-self`} className="border-t border-rule pt-4">
          <h2 id={`${id}-self`} className="mb-2 font-sans text-sm font-semibold text-ink">
            {t("selfCheckTitle")}
          </h2>
          {selfCheck.solutionHtml ? (
            <div
              className="mb-4 font-serif text-base text-ink"
              dangerouslySetInnerHTML={{ __html: selfCheck.solutionHtml }}
            />
          ) : null}
          <p className="mb-2 text-sm text-ink-muted">{t("selfCheckLead")}</p>
          <ul className="grid gap-2">
            {selfCheck.rubricHtml.map((html, i) => (
              <li key={html}>
                <label className="flex cursor-pointer items-start gap-3 text-base text-ink">
                  <input
                    type="checkbox"
                    className="mt-1.5 size-4 accent-(--accent)"
                    disabled={savedSelf}
                    checked={ticked.includes(i)}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setTicked((prev) => (on ? [...prev, i] : prev.filter((x) => x !== i)));
                    }}
                  />
                  {rich(html)}
                </label>
              </li>
            ))}
          </ul>
          {savedSelf ? (
            <p role="status" className="mt-3 text-sm text-ink">
              {t("selfSaved", { met: ticked.length, total: selfCheck.rubricHtml.length })}
            </p>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              disabled={empty}
              onClick={saveSelfAssessment}
            >
              {t("saveSelf")}
            </Button>
          )}
        </section>
      ) : null}
    </div>
  );
}

function AiResult({ graded }: { graded: Graded }) {
  const t = useTranslations("exercises.open");
  const id = useId();
  const { grade } = graded;
  const [note, setNote] = useState("");
  const [reported, setReported] = useState<"no" | "open" | "sent" | "failed">("no");
  const [pending, startTransition] = useTransition();

  return (
    <section
      aria-labelledby={`${id}-ai`}
      className={cx(
        "border-l-2 py-1 pl-4",
        grade.verdict === "correct"
          ? "border-correct"
          : grade.verdict === "partial"
            ? "border-accent"
            : "border-wrong",
      )}
    >
      <h2 id={`${id}-ai`} className="font-sans text-base font-semibold text-ink">
        {t("score", { score: grade.score })}
      </h2>
      <p className="mt-1 text-base text-ink">{grade.feedback}</p>
      <ul className="mt-3 grid gap-1 text-sm">
        {grade.rubricItems.map((item) => (
          <li key={item.index}>
            <span className="font-sans font-semibold">{t(`status.${item.status}`)}</span>
            {item.reason ? ` — ${item.reason}` : null}
          </li>
        ))}
      </ul>
      {grade.misconceptions.length > 0 ? (
        <>
          <h3 className="mt-3 font-sans text-sm font-semibold text-ink">{t("misconceptions")}</h3>
          <ul className="list-disc pl-5 text-sm">
            {grade.misconceptions.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="mt-3 text-sm">
        <span className="font-sans font-semibold">{t("nextStep")}</span> {grade.nextStep}
      </p>
      <p className="mt-2 font-sans text-xs text-ink-muted">{t("aiNote")}</p>

      {graded.attemptId !== null && reported !== "sent" ? (
        reported === "no" ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-2"
            onClick={() => {
              setReported("open");
            }}
          >
            {t("report")}
          </Button>
        ) : (
          <form
            className="mt-3 grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const attemptId = graded.attemptId;
              if (attemptId === null || !note.trim()) return;
              startTransition(async () => {
                const res = await reportUnfairGrade({ attemptId, note }).catch(() => null);
                setReported(res?.ok ? "sent" : "failed");
              });
            }}
          >
            <Label htmlFor={`${id}-note`}>{t("reportNote")}</Label>
            <Textarea
              id={`${id}-note`}
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
              }}
            />
            <div>
              <Button type="submit" variant="secondary" disabled={pending || !note.trim()}>
                {t("reportSend")}
              </Button>
            </div>
            {reported === "failed" ? (
              <p className="text-sm text-wrong">{t("reportFailed")}</p>
            ) : null}
          </form>
        )
      ) : null}
      {reported === "sent" ? <p className="mt-2 text-sm text-ink">{t("reported")}</p> : null}
    </section>
  );
}

/** One probing question from the "interviewer" (Phase 11), answered for practice only. */
function FollowUp({
  exerciseId,
  version,
  lang,
  answer,
}: {
  exerciseId: string;
  version: number;
  lang: "pl" | "en";
  answer: string;
}) {
  const t = useTranslations("interview.followUp");
  const id = useId();
  const [question, setQuestion] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();
  if (question === null) {
    return (
      <div className="grid gap-2">
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await fetch("/api/interview/follow-up", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ exerciseId, version, locale: lang, answer }),
                }).catch(() => null);
                const body = (await res?.json().catch(() => null)) as { question?: string } | null;
                if (body?.question) setQuestion(body.question);
                else setFailed(true);
              });
            }}
          >
            {pending ? t("asking") : t("ask")}
          </Button>
        </div>
        <p className="font-sans text-xs text-ink-muted">{t("quota")}</p>
        {failed ? <p className="text-sm text-wrong">{t("failed")}</p> : null}
      </div>
    );
  }
  return (
    <section aria-labelledby={`${id}-q`} className="grid gap-2 border-t border-rule pt-4">
      <h3 id={`${id}-q`} className="font-sans text-sm font-semibold text-ink">
        {t("title")}
      </h3>
      <p className="text-base text-ink">{question}</p>
      <Label htmlFor={`${id}-reply`}>{t("reply")}</Label>
      <Textarea
        id={`${id}-reply`}
        rows={4}
        value={reply}
        onChange={(e) => {
          setReply(e.target.value);
        }}
      />
      <FieldHint>{t("practice")}</FieldHint>
    </section>
  );
}
