"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { setEmailByLink } from "./actions";

/**
 * The page an email's unsubscribe link opens (Phase 15). It switches the email off as
 * soon as it loads (one click: the link), from script, so link scanners that only fetch
 * the page change nothing. A button turns it back on.
 */
export function UnsubscribeView({ u, k, s }: { u: string; k: string; s: string }) {
  const t = useTranslations("notify.unsubscribe");
  const [state, setState] = useState<"working" | "off" | "on" | "invalid">("working");
  const [pending, startTransition] = useTransition();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void setEmailByLink({ u, k, s, on: false }).then((r) => {
      setState(r.ok ? "off" : "invalid");
    });
  }, [u, k, s]);

  const kindName = ["streak", "weekly", "league"].includes(k) ? t(`kind.${k as "streak"}`) : "";

  return (
    <div data-unsubscribe={state} className="grid max-w-(--measure) gap-4" aria-live="polite">
      {state === "working" ? <p className="text-ink-muted">{t("working")}</p> : null}
      {state === "invalid" ? <p className="text-wrong">{t("invalid")}</p> : null}
      {state === "off" ? (
        <>
          <p className="font-serif text-reading">{t("done", { kind: kindName })}</p>
          <Button
            type="button"
            variant="secondary"
            className="justify-self-start"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const r = await setEmailByLink({ u, k, s, on: true });
                if (r.ok) setState("on");
              });
            }}
          >
            {t("undo")}
          </Button>
        </>
      ) : null}
      {state === "on" ? (
        <p className="font-serif text-reading">{t("back", { kind: kindName })}</p>
      ) : null}
      <p className="font-sans text-xs text-ink-muted">{t("settingsNote")}</p>
    </div>
  );
}
