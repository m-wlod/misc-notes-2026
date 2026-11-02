"use client";

import type Katex from "katex";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";

import { NumberInput } from "@/components/ui/number-input";
import { cx } from "@/lib/cx";
import { ExprError, parseExpr, toTex } from "@/lib/math/expr";

import type { PublicOption } from "./view";

type KatexModule = typeof Katex;

/** Answer inputs for each exercise type. Controlled; the card owns the value. */

const optionHtml = (o: PublicOption) => <span dangerouslySetInnerHTML={{ __html: o.html }} />;

export function NumberAnswer({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations("exercises");
  const invalid = useTranslations("placement.invalid");
  const id = useId();
  return (
    <div className="grid max-w-xs gap-1.5">
      <label htmlFor={id} className="text-sm text-ink">
        {t("answer")}
      </label>
      <NumberInput
        id={id}
        value={value}
        disabled={disabled}
        onValueChange={(raw) => {
          onChange(raw);
        }}
        invalidMessage={(reason) => invalid(reason)}
      />
    </div>
  );
}

export function SliderAnswer({
  value,
  onChange,
  disabled,
  min,
  max,
  step,
  locale,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  min: number;
  max: number;
  step: number;
  locale: string;
}) {
  const t = useTranslations("exercises.slider");
  const id = useId();
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });
  return (
    <div className="grid max-w-md gap-2">
      <label htmlFor={id} className="text-sm text-ink">
        {t("label")}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        className="w-full accent-(--accent)"
      />
      <p className="num text-sm text-ink-muted" aria-live="polite">
        {t("value", { value: fmt.format(value) })}
      </p>
    </div>
  );
}

/** Text input with a live KaTeX preview (KaTeX loads only when this input is used). */
export function ExpressionAnswer({
  value,
  onChange,
  disabled,
  locale,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  locale: string;
}) {
  const t = useTranslations("exercises.expression");
  const id = useId();
  // Parse synchronously; KaTeX (large) loads once, on first use of this input.
  const [katex, setKatex] = useState<KatexModule | null>(null);
  const parsed = useMemo(() => {
    if (!value.trim()) return null;
    try {
      return { tex: toTex(parseExpr(value), locale === "pl") };
    } catch (e) {
      return { error: e instanceof ExprError ? e.message : String(e) };
    }
  }, [value, locale]);
  const needsKatex = parsed !== null && "tex" in parsed && katex === null;
  useEffect(() => {
    if (!needsKatex) return;
    let cancelled = false;
    void import("katex").then((mod) => {
      if (!cancelled) setKatex(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [needsKatex]);
  const preview =
    parsed === null
      ? null
      : "error" in parsed
        ? { error: parsed.error }
        : katex
          ? {
              html: katex.renderToString(parsed.tex, {
                throwOnError: false,
                output: "htmlAndMathml",
              }),
            }
          : null;

  return (
    <div className="grid max-w-md gap-1.5">
      <label htmlFor={id} className="text-sm text-ink">
        {t("label")}
      </label>
      <input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        disabled={disabled}
        aria-describedby={`${id}-hint ${id}-preview`}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="rounded border border-rule-strong bg-surface px-3 py-2 font-mono text-base text-ink"
      />
      <p id={`${id}-hint`} className="text-xs text-ink-muted">
        {t("hint")}
      </p>
      <div
        id={`${id}-preview`}
        aria-live="polite"
        className="min-h-12 rounded border border-rule bg-bg px-3 py-2"
        data-testid="expression-preview"
      >
        <span className="mr-2 font-sans text-xs text-ink-muted">{t("preview")}</span>
        {preview && "html" in preview ? (
          <span dangerouslySetInnerHTML={{ __html: preview.html }} />
        ) : preview && "error" in preview ? (
          <span className="text-sm text-wrong">{t("invalid", { reason: preview.error })}</span>
        ) : null}
      </div>
    </div>
  );
}

export function ChoiceAnswer({
  name,
  options,
  value,
  onChange,
  disabled,
}: {
  name: string;
  options: readonly PublicOption[];
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations("exercises");
  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{t("answer")}</legend>
      {options.map((o) => (
        <label
          key={o.id}
          className={cx(
            "flex cursor-pointer items-center gap-3 rounded border px-3 py-2 text-base",
            value === o.id ? "border-ink bg-sunken" : "border-rule-strong",
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.id}
            checked={value === o.id}
            disabled={disabled}
            onChange={() => {
              onChange(o.id);
            }}
            className="size-4 accent-(--accent)"
          />
          {optionHtml(o)}
        </label>
      ))}
    </fieldset>
  );
}

export function MultiAnswer({
  options,
  values,
  onChange,
  disabled,
}: {
  options: readonly PublicOption[];
  values: readonly string[];
  onChange: (v: string[]) => void;
  disabled: boolean;
}) {
  const t = useTranslations("exercises");
  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{t("answer")}</legend>
      {options.map((o) => {
        const checked = values.includes(o.id);
        return (
          <label
            key={o.id}
            className={cx(
              "flex cursor-pointer items-center gap-3 rounded border px-3 py-2 text-base",
              checked ? "border-ink bg-sunken" : "border-rule-strong",
            )}
          >
            <input
              type="checkbox"
              value={o.id}
              checked={checked}
              disabled={disabled}
              onChange={() => {
                onChange(checked ? values.filter((v) => v !== o.id) : [...values, o.id]);
              }}
              className="size-4 accent-(--accent)"
            />
            {optionHtml(o)}
          </label>
        );
      })}
    </fieldset>
  );
}

/** Reorder by dragging or with the move buttons; moves are announced. */
export function OrderingAnswer({
  options,
  order,
  onChange,
  disabled,
}: {
  options: readonly PublicOption[];
  order: readonly string[];
  onChange: (v: string[]) => void;
  disabled: boolean;
}) {
  const t = useTranslations("exercises.ordering");
  const [announce, setAnnounce] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const byId = new Map(options.map((o) => [o.id, o]));
  const plain = (id: string) => {
    const html = byId.get(id)?.html ?? id;
    return html.replaceAll(/<annotation[\s\S]*?<\/annotation>/g, "").replaceAll(/<[^>]+>/g, "");
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    if (item === undefined) return;
    next.splice(to, 0, item);
    onChange(next);
    setAnnounce(t("moved", { item: plain(item), position: to + 1 }));
  };

  return (
    <div className="grid gap-2">
      <p className="text-sm text-ink-muted">{t("drag")}</p>
      <ol className="grid gap-2" aria-label={t("label")}>
        {order.map((id, i) => {
          const option = byId.get(id);
          if (!option) return null;
          return (
            // Dragging is a pointer extra; the move buttons below are the accessible path.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <li
              key={id}
              draggable={!disabled}
              onDragStart={() => {
                setDragging(id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={() => {
                if (dragging) move(order.indexOf(dragging), i);
                setDragging(null);
              }}
              data-option={id}
              className={cx(
                "flex items-center gap-3 rounded border border-rule-strong bg-surface px-3 py-2",
                !disabled && "cursor-grab",
                dragging === id && "opacity-50",
              )}
            >
              <span className="w-5 num text-sm text-ink-muted">{i + 1}.</span>
              <span className="flex-1 text-base">{optionHtml(option)}</span>
              <button
                type="button"
                disabled={disabled || i === 0}
                aria-label={t("up", { item: plain(id) })}
                onClick={() => {
                  move(i, i - 1);
                }}
                className="rounded px-2 py-1 text-ink-muted hover:bg-sunken hover:text-ink disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={disabled || i === order.length - 1}
                aria-label={t("down", { item: plain(id) })}
                onClick={() => {
                  move(i, i + 1);
                }}
                className="rounded px-2 py-1 text-ink-muted hover:bg-sunken hover:text-ink disabled:opacity-30"
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}

export function CodeView({ starter }: { starter: string }) {
  const t = useTranslations("exercises.code");
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm text-ink">
        {t("label")}
      </label>
      <textarea
        id={id}
        readOnly
        rows={Math.max(3, starter.split("\n").length)}
        value={starter}
        className="rounded border border-rule-strong bg-sunken px-3 py-2 font-mono text-sm text-ink"
      />
      <p className="text-sm text-ink-muted">{t("soon")}</p>
    </div>
  );
}
