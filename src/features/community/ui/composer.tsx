"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import type { CommunityResult } from "../actions";
import { MAX_POST_CHARS } from "../limits";
import type { renderMarkdown } from "../markdown";

export const inputClass =
  "w-full rounded border border-rule-strong bg-surface px-3 py-2 font-sans text-base text-ink";

/** Turns an action result into the line under a form. */
export function useResultText() {
  const t = useTranslations("community");
  return (r: CommunityResult | null) =>
    r === null
      ? ""
      : r.ok
        ? r.held
          ? t("composer.held")
          : t("composer.sent")
        : t(`errors.${r.reason}`);
}

/**
 * The markdown composer with a preview (Phase 17b). The preview uses the same safe
 * renderer as the server, so what you see is what gets posted.
 */
export function Composer({
  label,
  submitLabel,
  linksAllowed,
  initial = "",
  maxChars = MAX_POST_CHARS,
  onSubmit,
  onCancel,
}: {
  label: string;
  submitLabel: string;
  linksAllowed: boolean;
  initial?: string;
  maxChars?: number;
  onSubmit: (body: string) => Promise<CommunityResult>;
  onCancel?: () => void;
}) {
  const t = useTranslations("community.composer");
  const text = useResultText();
  const id = useId();
  const [body, setBody] = useState(initial);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [result, setResult] = useState<CommunityResult | null>(null);
  const [pending, startTransition] = useTransition();
  // The renderer (with KaTeX) loads on the first preview: every lesson, exercise and
  // debunk page carries this composer, and most visitors never preview a post.
  const [render, setRender] = useState<typeof renderMarkdown | null>(null);
  useEffect(() => {
    if (tab !== "preview" || render) return;
    void import("../markdown").then((m) => {
      setRender(() => m.renderMarkdown);
    });
  }, [tab, render]);
  const preview = render ? render(body, { links: linksAllowed }) : null;
  return (
    <form
      data-composer=""
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await onSubmit(body);
          setResult(r);
          if (r.ok) {
            setBody("");
            setTab("write");
          }
        });
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label htmlFor={`${id}-body`} className="font-sans text-sm text-ink">
          {label}
        </label>
        <div role="group" className="flex gap-1 font-sans text-sm">
          {(["write", "preview"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={tab === v}
              onClick={() => {
                setTab(v);
              }}
              className="rounded px-2 py-0.5 text-ink-muted aria-pressed:bg-sunken aria-pressed:text-ink"
            >
              {t(v)}
            </button>
          ))}
        </div>
      </div>
      <textarea
        id={`${id}-body`}
        rows={4}
        maxLength={maxChars}
        hidden={tab === "preview"}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
        }}
        aria-describedby={`${id}-hint`}
        className={inputClass}
      />
      {tab === "preview" ? (
        <div
          data-preview=""
          className="community-body min-h-24 rounded border border-rule px-3 py-2 font-serif text-reading"
          // Output of the escape-first renderer (markdown.ts): no raw HTML path.
          dangerouslySetInnerHTML={{
            __html:
              preview === null
                ? ""
                : preview || `<p class="text-ink-muted">${t("previewEmpty")}</p>`,
          }}
        />
      ) : null}
      <p id={`${id}-hint`} className="font-sans text-xs text-ink-muted">
        {t("charsLeft", { count: maxChars - body.length })}
        {linksAllowed ? "" : ` · ${t("noLinks")}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pending || body.trim().length < 2}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
        <p role="status" className="font-sans text-sm empty:hidden">
          {text(result)}
        </p>
      </div>
    </form>
  );
}
