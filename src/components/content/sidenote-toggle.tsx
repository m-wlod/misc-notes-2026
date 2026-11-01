"use client";

import { useId, useState, type ReactNode } from "react";

import { cx } from "@/lib/cx";

type Props = { n: number; srLabel: string; buttonLabel: string; children: ReactNode };

/**
 * A margin note. Wide screens: always shown in the right margin. Phones and tablets: the
 * number is a button that expands the note under its line (tap or keyboard). Print: always
 * shown, as a footnote under the paragraph.
 */
export function SidenoteToggle({ n, srLabel, buttonLabel, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={buttonLabel}
        onClick={() => {
          setOpen((o) => !o);
        }}
        className="mx-0.5 inline-flex min-h-6 min-w-6 items-start justify-center rounded-sm align-super num text-xs text-accent-text wide:hidden print:hidden"
      >
        {n}
      </button>
      <sup
        aria-hidden="true"
        className="ml-0.5 hidden num text-xs text-ink-muted wide:inline print:inline"
      >
        {n}
      </sup>
      <span
        id={id}
        role="note"
        data-open={open}
        className={cx(
          "my-3 border-l-2 border-rule pl-3 font-sans text-sm leading-normal text-ink-muted",
          open ? "block" : "hidden",
          "wide:absolute wide:left-[calc(100%+2.5rem)] wide:my-0 wide:block wide:w-56 wide:border-l-0 wide:pl-0",
          "print:static print:my-2 print:block print:w-auto print:border-l-2 print:pl-3",
        )}
      >
        <span className="sr-only">{`${srLabel} ${String(n)}: `}</span>
        <sup aria-hidden="true" className="mr-1 num text-ink">
          {n}
        </sup>
        {children}
      </span>
    </>
  );
}
