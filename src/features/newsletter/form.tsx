"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { track } from "@/features/analytics/client";
import { cx } from "@/lib/cx";

import { subscribe, type SubscribeResult } from "./actions";

/**
 * "Problem tygodnia + Debunk" sign-up (Phase 19c). Double opt-in: the answer is always
 * "check your inbox", whether or not the address was already on the list.
 */
export function NewsletterForm({
  compact = false,
  place = "footer",
}: {
  compact?: boolean;
  /** Where the form is, for the analytics funnel (Phase 22b). */
  place?: "landing" | "footer" | "links";
}) {
  const t = useTranslations("newsletter");
  const locale = useLocale();
  const id = useId();
  const [status, setStatus] = useState<SubscribeResult["status"] | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => {
      const v = form.get(name);
      return typeof v === "string" ? v : "";
    };
    startTransition(async () => {
      const r = await subscribe({ email: text("email"), locale, website: text("website") }).catch(
        () => ({ status: "unavailable" as const }),
      );
      setStatus(r.status);
      if (r.status === "sent") track("newsletter_subscribed", { place });
    });
  };

  if (status === "sent") {
    return (
      <p role="status" data-newsletter="sent" className="font-sans text-sm">
        {t("sent")}
      </p>
    );
  }
  return (
    <form
      onSubmit={submit}
      // Not a named landmark: the form sits in the footer of every page and once more on
      // the landing, and landmarks must be unique.
      data-newsletter-form
      className={cx("grid gap-2 font-sans text-sm", compact ? "max-w-sm" : "max-w-md")}
    >
      <p className="font-medium text-ink">{t("title")}</p>
      {compact ? null : <p className="text-ink-muted">{t("lead")}</p>}
      <div className="flex flex-wrap gap-2">
        <label htmlFor={`${id}-email`} className="sr-only">
          {t("email")}
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t("placeholder")}
          className="min-w-0 flex-1 rounded border border-rule-strong bg-surface px-3 py-2"
        />
        {/* Honeypot: hidden from people and screen readers. */}
        <input
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        <Button type="submit" disabled={pending}>
          {t("submit")}
        </Button>
      </div>
      <p className="text-xs text-ink-muted">{t("privacy")}</p>
      {status ? (
        <p role="alert" className="text-xs text-wrong">
          {t(`errors.${status}`)}
        </p>
      ) : null}
    </form>
  );
}
