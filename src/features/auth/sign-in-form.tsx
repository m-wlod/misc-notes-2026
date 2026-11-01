"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";

import { requestMagicLink, signInWithProvider, type MagicLinkState } from "./actions";

type Props = { providers: readonly ("google" | "github")[]; callbackError: boolean };

/** Remounting the form (new key) is how "use another address" resets the action state. */
export function SignInForm(props: Props) {
  const [attempt, setAttempt] = useState(0);
  return (
    <MagicLinkForm
      key={attempt}
      {...props}
      callbackError={props.callbackError && attempt === 0}
      onReset={() => {
        setAttempt((n) => n + 1);
      }}
    />
  );
}

function MagicLinkForm({ providers, callbackError, onReset }: Props & { onReset: () => void }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(requestMagicLink, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <div role="status" className="max-w-md border-l-2 border-correct py-1 pl-5">
        <h2 className="mb-2 text-xl">{t("sentTitle")}</h2>
        <p className="mb-4 text-base">{t("sentBody", { email: state.email })}</p>
        <Button variant="ghost" size="sm" onClick={onReset}>
          {t("useAnother")}
        </Button>
      </div>
    );
  }

  const error = state.status === "error" ? state.error : callbackError ? "callback" : null;

  return (
    <div className="grid max-w-md gap-8">
      <form action={action} className="grid gap-3" noValidate>
        <input type="hidden" name="locale" value={locale} />
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.status === "error" ? state.email : ""}
          aria-invalid={error === "invalidEmail" || undefined}
          aria-describedby={error ? "sign-in-error" : undefined}
        />
        {error && error !== "notConfigured" ? (
          <FieldError id="sign-in-error">{t(`errors.${error}`)}</FieldError>
        ) : null}
        {error === "notConfigured" ? (
          <FieldError id="sign-in-error">{t("notConfigured")}</FieldError>
        ) : null}
        <Button type="submit" disabled={pending} className="justify-self-start">
          {pending ? t("sending") : t("submit")}
        </Button>
      </form>

      {providers.length > 0 ? (
        <div className="grid gap-3">
          <p className="flex items-center gap-3 text-sm text-ink-muted">
            <span className="h-px flex-1 bg-rule" />
            {t("or")}
            <span className="h-px flex-1 bg-rule" />
          </p>
          {providers.map((provider) => (
            <form key={provider} action={signInWithProvider}>
              <input type="hidden" name="provider" value={provider} />
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" variant="secondary" className="w-full">
                {t(provider)}
              </Button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}
