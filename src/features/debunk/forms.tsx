"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { finishEntry, reportCorrection, submitClaim } from "./actions";
import type { SubmitResult } from "./submit";

/** Moderated submissions and the read tracker for Debunk Lab (Phase 16). */
const inputClass =
  "w-full rounded border border-rule-strong bg-surface px-3 py-2 font-sans text-base text-ink";

function Status({ result, sent }: { result: SubmitResult | null; sent: string }) {
  const t = useTranslations("debunk.errors");
  return (
    <p role="status" className="font-sans text-sm empty:hidden">
      {result === null ? "" : result.ok ? sent : t(result.reason)}
    </p>
  );
}

/** The hidden honeypot field: off-screen and out of the tab order, labelled for bots. */
function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
      </label>
    </div>
  );
}

export function SubmitClaimForm() {
  const t = useTranslations("debunk.submit");
  const id = useId();
  const [claim, setClaim] = useState("");
  const [source, setSource] = useState("");
  const [website, setWebsite] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      data-submit-claim=""
      className="relative grid max-w-(--measure) gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await submitClaim({ claim, sourceUrl: source, website });
          setResult(r);
          if (r.ok) {
            setClaim("");
            setSource("");
          }
        });
      }}
    >
      <label htmlFor={`${id}-claim`} className="font-sans text-sm text-ink">
        {t("claim")}
      </label>
      <textarea
        id={`${id}-claim`}
        rows={3}
        maxLength={2000}
        value={claim}
        onChange={(e) => {
          setClaim(e.target.value);
        }}
        className={inputClass}
      />
      <label htmlFor={`${id}-source`} className="font-sans text-sm text-ink">
        {t("source")}
      </label>
      <input
        id={`${id}-source`}
        type="url"
        inputMode="url"
        maxLength={500}
        value={source}
        onChange={(e) => {
          setSource(e.target.value);
        }}
        className={inputClass}
      />
      <Honeypot value={website} onChange={setWebsite} />
      <div>
        <Button type="submit" disabled={pending}>
          {t("send")}
        </Button>
      </div>
      <Status result={result} sent={t("sent")} />
    </form>
  );
}

export function CorrectionForm({ entryId }: { entryId: string }) {
  const t = useTranslations("debunk.correction");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div data-correction="" className="grid gap-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="justify-self-start"
        aria-expanded={open}
        aria-controls={`${id}-form`}
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        {t("open")}
      </Button>
      {open ? (
        <form
          id={`${id}-form`}
          className="relative grid max-w-(--measure) gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await reportCorrection({ entryId, body, website });
              setResult(r);
              if (r.ok) setBody("");
            });
          }}
        >
          <label htmlFor={`${id}-body`} className="font-sans text-sm text-ink">
            {t("label")}
          </label>
          <textarea
            id={`${id}-body`}
            rows={4}
            maxLength={5000}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
            }}
            className={inputClass}
          />
          <Honeypot value={website} onChange={setWebsite} />
          <div>
            <Button type="submit" size="sm" disabled={pending}>
              {t("send")}
            </Button>
          </div>
          <Status result={result} sent={t("sent")} />
        </form>
      ) : null}
    </div>
  );
}

/** Marks the entry as read when its end scrolls into view (signed in; else nothing). */
export function FinishTracker({ entryId }: { entryId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        void finishEntry({ id: entryId }).catch(() => undefined);
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [entryId]);
  return <div ref={ref} aria-hidden="true" className="h-px" />;
}
