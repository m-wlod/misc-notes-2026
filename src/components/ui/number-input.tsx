"use client";

import { useState, type ComponentProps } from "react";

import { cx } from "@/lib/cx";
import { parseLocaleNumber, type ParseNumberResult } from "@/lib/math/parse-number";

import { fieldClass } from "./field";

export type NumberInputProps = Omit<ComponentProps<"input">, "type" | "inputMode" | "onChange"> & {
  /** Raw text and its parse result, on every keystroke. */
  onValueChange?: (raw: string, parsed: ParseNumberResult) => void;
};

/**
 * Free-text numeric input that accepts `0,25`, `0.25`, `12,5%`, `3/8`, `1e-3`.
 * It never rewrites what the learner typed; it only marks unparseable input as invalid
 * after blur. Grading happens on the server with the same parser.
 */
export function NumberInput({ className, onValueChange, onBlur, ...props }: NumberInputProps) {
  const [invalid, setInvalid] = useState(false);

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      aria-invalid={invalid || undefined}
      className={cx(fieldClass, "h-10 w-40 num text-base", className)}
      onChange={(e) => {
        const parsed = parseLocaleNumber(e.target.value);
        if (invalid && parsed.ok) setInvalid(false);
        onValueChange?.(e.target.value, parsed);
      }}
      onBlur={(e) => {
        const parsed = parseLocaleNumber(e.target.value);
        setInvalid(!parsed.ok && parsed.reason !== "empty");
        onBlur?.(e);
      }}
      {...props}
    />
  );
}
