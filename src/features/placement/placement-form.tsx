"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button, buttonClass } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { Link } from "@/i18n/navigation";

import { submitPlacement, type PlacementOutcome } from "./actions";

/** `ids` are the question ids (text comes from messages); answers are graded server-side. */
export function PlacementForm({ ids }: { ids: readonly string[] }) {
  const t = useTranslations("placement");
  const levels = useTranslations("onboarding.levels");
  const [state, action, pending] = useActionState<PlacementOutcome, FormData>(submitPlacement, {
    status: "idle",
  });
  const graded = state.status === "graded" ? state : null;
  const resultOf = (id: string) => graded?.results.find((r) => r.id === id);

  return (
    <div className="grid max-w-(--measure) gap-10">
      {graded ? (
        <section
          aria-labelledby="result-title"
          role="status"
          className="border-l-2 border-accent py-1 pl-5"
        >
          <h2 id="result-title" className="mb-2 text-xl">
            {t("result.title")}
          </h2>
          <p className="text-base">
            {t("result.score", {
              correct: graded.results.filter((r) => r.correct).length,
              total: graded.results.length,
            })}
          </p>
          <p className="mb-4 text-base">
            {t("result.suggested", {
              level: `${String(graded.suggested)} · ${levels(`${String(graded.suggested) as "1"}.name`)}`,
            })}
          </p>
          <Link href="/profile" className={buttonClass("primary")}>
            {t("result.toProfile")}
          </Link>
        </section>
      ) : null}

      <form action={action} className="grid gap-8">
        <ol className="grid gap-8">
          {ids.map((id, i) => {
            const result = resultOf(id);
            return (
              <li key={id} className="grid gap-2">
                <p className="num text-xs text-ink-muted">{t("question", { number: i + 1 })}</p>
                <p className="font-serif text-reading">
                  {t(`questions.${id as "die-expected-value"}`)}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor={`a-${id}`} className="sr-only">
                    {`${t("answer")} ${String(i + 1)}`}
                  </Label>
                  <NumberInput
                    id={`a-${id}`}
                    name={id}
                    disabled={Boolean(graded)}
                    invalidMessage={(reason) => t(`invalid.${reason}`)}
                  />
                  {result ? (
                    <span
                      className={result.correct ? "text-sm text-correct" : "text-sm text-wrong"}
                    >
                      {result.correct ? t("result.correct") : t("result.wrong")}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
        {state.status === "error" ? <FieldError>{t("error")}</FieldError> : null}
        {!graded ? (
          <Button type="submit" disabled={pending} className="justify-self-start">
            {pending ? t("checking") : t("submit")}
          </Button>
        ) : null}
      </form>
    </div>
  );
}
