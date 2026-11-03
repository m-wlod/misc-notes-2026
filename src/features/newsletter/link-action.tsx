"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { confirmSubscription, unsubscribeNewsletter } from "./actions";

/**
 * The one button on the newsletter's confirmation and unsubscribe pages (Phase 19c).
 * A click, not the link itself, does the change: mail scanners open links, people click.
 */
export function NewsletterLinkAction(
  props: { kind: "confirm"; token: string } | { kind: "unsubscribe"; i: string; s: string },
) {
  const t = useTranslations("newsletter");
  const [result, setResult] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();
  if (result !== null) {
    return (
      <p
        role={result ? "status" : "alert"}
        data-newsletter-result={result ? "ok" : "failed"}
        className={result ? "font-sans" : "font-sans text-wrong"}
      >
        {result ? t(`${props.kind}.done`) : t(`${props.kind}.failed`)}
      </p>
    );
  }
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r =
            props.kind === "confirm"
              ? await confirmSubscription({ token: props.token }).catch(() => ({ ok: false }))
              : await unsubscribeNewsletter({ i: props.i, s: props.s }).catch(() => ({
                  ok: false,
                }));
          setResult(r.ok);
        });
      }}
    >
      {t(`${props.kind}.button`)}
    </Button>
  );
}
