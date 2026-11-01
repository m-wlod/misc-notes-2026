import { Label as RadixLabel } from "radix-ui";
import type { ComponentProps } from "react";

import { cx } from "@/lib/cx";

/** Shared look for text-like controls. Border is rule-strong (3:1 against surface). */
export const fieldClass = cx(
  "w-full rounded border border-rule-strong bg-surface px-3 text-ink",
  "placeholder:text-ink-muted",
  "aria-invalid:border-wrong",
  "disabled:opacity-50",
);

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldClass, "h-10 text-base", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldClass, "min-h-24 py-2 text-base", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<typeof RadixLabel.Root>) {
  return <RadixLabel.Root className={cx("text-sm font-medium text-ink", className)} {...props} />;
}

export function FieldHint({ className, ...props }: ComponentProps<"p">) {
  return <p className={cx("text-sm text-ink-muted", className)} {...props} />;
}

export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return <p role="alert" className={cx("text-sm text-wrong", className)} {...props} />;
}
