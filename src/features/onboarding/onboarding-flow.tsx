"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button, buttonClass } from "@/components/ui/button";
import { RadioGroup, RadioItem } from "@/components/ui/choice";
import { FieldError, Label } from "@/components/ui/field";
import { track } from "@/features/analytics/client";
import { Link } from "@/i18n/navigation";

import { saveOnboarding, type OnboardingInput } from "./actions";

const GOALS = ["trading", "interviews", "university", "curiosity"] as const;
const LEVELS = ["1", "2", "3", "4", "5"] as const;
const MINUTES = ["5", "10", "20"] as const;
const TOTAL = 3;

type Initial = {
  goal: OnboardingInput["goal"] | null;
  self_level: number | null;
  daily_goal_minutes: number;
};

/** Three short screens (goal, level, daily time), then an offer to take the placement quiz. */
export function OnboardingFlow({ initial }: { initial: Initial }) {
  const t = useTranslations("onboarding");
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<string>(initial.goal ?? "");
  const [level, setLevel] = useState<string>(initial.self_level ? String(initial.self_level) : "");
  const [minutes, setMinutes] = useState<string>(String(initial.daily_goal_minutes));
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <section aria-labelledby="done-title" className="max-w-(--measure)">
        <h2 id="done-title" className="mb-3 text-xl">
          {t("done.title")}
        </h2>
        <p className="mb-6 font-serif text-reading">{t("done.body")}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/placement" className={buttonClass("primary")}>
            {t("done.quiz")}
          </Link>
          <Link href="/profile" className={buttonClass("secondary")}>
            {t("done.skip")}
          </Link>
        </div>
      </section>
    );
  }

  const canContinue = (step === 1 && goal) || (step === 2 && level) || (step === 3 && minutes);

  const finish = () => {
    setFailed(false);
    startTransition(async () => {
      const res = await saveOnboarding({
        goal: goal as OnboardingInput["goal"],
        self_level: Number(level),
        daily_goal_minutes: Number(minutes) as OnboardingInput["daily_goal_minutes"],
      });
      if (res.ok) {
        track("signed_up", { goal, level: Number(level) });
        setDone(true);
      } else setFailed(true);
    });
  };

  return (
    <form
      className="grid max-w-(--measure) gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canContinue) return;
        if (step < TOTAL) setStep(step + 1);
        else finish();
      }}
    >
      <p className="num text-xs text-ink-muted" aria-live="polite">
        {t("step", { current: step, total: TOTAL })}
      </p>

      {step === 1 ? (
        <Question title={t("goal.title")}>
          <RadioGroup value={goal} onValueChange={setGoal} aria-labelledby="q-title">
            {GOALS.map((g) => (
              <Choice key={g} id={`goal-${g}`} value={g} label={t(`goal.${g}`)} />
            ))}
          </RadioGroup>
        </Question>
      ) : null}

      {step === 2 ? (
        <Question title={t("level.title")} hint={t("level.hint")}>
          <RadioGroup value={level} onValueChange={setLevel} aria-labelledby="q-title">
            {LEVELS.map((l) => (
              <Choice
                key={l}
                id={`level-${l}`}
                value={l}
                label={`${l} · ${t(`levels.${l}.name`)}`}
                detail={t(`levels.${l}.who`)}
              />
            ))}
          </RadioGroup>
        </Question>
      ) : null}

      {step === 3 ? (
        <Question title={t("daily.title")} hint={t("daily.hint")}>
          <RadioGroup value={minutes} onValueChange={setMinutes} aria-labelledby="q-title">
            {MINUTES.map((m) => (
              <Choice
                key={m}
                id={`daily-${m}`}
                value={m}
                label={t("daily.minutes", { minutes: Number(m) })}
              />
            ))}
          </RadioGroup>
        </Question>
      ) : null}

      {failed ? <FieldError>{t("error")}</FieldError> : null}

      <div className="flex gap-3">
        {step > 1 ? (
          <Button
            variant="ghost"
            onClick={() => {
              setStep(step - 1);
            }}
          >
            {t("back")}
          </Button>
        ) : null}
        <Button type="submit" disabled={!canContinue || pending}>
          {step < TOTAL ? t("next") : pending ? t("saving") : t("finish")}
        </Button>
      </div>
    </form>
  );
}

function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-4">
      <legend id="q-title" className="mb-1 font-serif text-xl">
        {title}
      </legend>
      {hint ? <p className="-mt-2 text-sm text-ink-muted">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

function Choice({
  id,
  value,
  label,
  detail,
}: {
  id: string;
  value: string;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <RadioItem id={id} value={value} className="mt-0.5" />
      <Label htmlFor={id} className="grid gap-0.5 font-normal">
        <span className="text-base">{label}</span>
        {detail ? <span className="text-sm text-ink-muted">{detail}</span> : null}
      </Label>
    </div>
  );
}
