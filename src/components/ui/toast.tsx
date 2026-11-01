"use client";

import { Toast as RadixToast } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cx } from "@/lib/cx";

export function ToastProvider({ children, label }: { children: ReactNode; label: string }) {
  return (
    <RadixToast.Provider duration={5000} label={label}>
      {children}
      <RadixToast.Viewport className="fixed right-0 bottom-0 z-(--z-toast) m-0 flex w-full max-w-sm list-none flex-col gap-2 p-4 outline-none" />
    </RadixToast.Provider>
  );
}

type ToastProps = ComponentProps<typeof RadixToast.Root> & {
  title: ReactNode;
  description?: ReactNode;
  tone?: "neutral" | "correct" | "wrong";
  closeLabel: string;
};

const tones = {
  neutral: "border-l-ink",
  correct: "border-l-correct",
  wrong: "border-l-wrong",
};

/** Restrained: a bordered panel with a 2px tone edge. No icons, no bounce. */
export function Toast({
  title,
  description,
  tone = "neutral",
  closeLabel,
  className,
  ...props
}: ToastProps) {
  return (
    <RadixToast.Root
      className={cx(
        "grid grid-cols-[1fr_auto] items-start gap-x-4 rounded border border-l-2 border-rule-strong bg-surface p-3 text-ink",
        tones[tone],
        className,
      )}
      {...props}
    >
      <RadixToast.Title className="text-sm font-medium">{title}</RadixToast.Title>
      <RadixToast.Close
        aria-label={closeLabel}
        className="rounded-sm text-ink-muted hover:text-ink"
      >
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
          <path d="m2.5 2.5 7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </RadixToast.Close>
      {description ? (
        <RadixToast.Description className="col-span-2 text-sm text-ink-muted">
          {description}
        </RadixToast.Description>
      ) : null}
    </RadixToast.Root>
  );
}
