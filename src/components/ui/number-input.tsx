"use client";

import { useId, useState, type ComponentProps } from "react";

import { cx } from "@/lib/cx";
import {
  parseLocaleNumber,
  type ParseNumberFailure,
  type ParseNumberResult,
} from "@/lib/math/parse-number";

import { FieldError, fieldClass } from "./field";

export type NumberInputProps = Omit<ComponentProps<"input">, "type" | "inputMode" | "onChange"> & {
  /** Raw text and its parse result, on every keystroke. */
  onValueChange?: (raw: string, parsed: ParseNumberResult) => void;
  /**
   * Localised message shown under the field when the text can't be read as a number,
   * linked via aria-describedby so it isn't conveyed by colour alone (WCAG 1.4.1).
   */
  invalidMessage: (reason: Exclude<ParseNumberFailure, "empty">) => string;
};

/**
 * Free-text numeric input that accepts `0,25`, `0.25`, `12,5%`, `3/8`, `1e-3`.
 * It never rewrites what the learner typed; it only flags unreadable input after blur.
 * Grading happens on the server with the same parser.
 */
export function NumberInput({
  className,
  onValueChange,
  onBlur,
  invalidMessage,
  id,
  "aria-describedby": describedBy,
  ...props
}: NumberInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const [failure, setFailure] = useState<Exclude<ParseNumberFailure, "empty"> | null>(null);

  return (
    <>
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={failure ? true : undefined}
        aria-describedby={
          [describedBy, failure ? errorId : null].filter(Boolean).join(" ") || undefined
        }
        className={cx(fieldClass, "h-10 w-40 num text-base", className)}
        onChange={(e) => {
          const parsed = parseLocaleNumber(e.target.value);
          if (failure && parsed.ok) setFailure(null);
          onValueChange?.(e.target.value, parsed);
        }}
        onBlur={(e) => {
          const parsed = parseLocaleNumber(e.target.value);
          setFailure(parsed.ok || parsed.reason === "empty" ? null : parsed.reason);
          onBlur?.(e);
        }}
        {...props}
      />
      {failure ? (
        <FieldError id={errorId} className="mt-1">
          {invalidMessage(failure)}
        </FieldError>
      ) : null}
    </>
  );
}
