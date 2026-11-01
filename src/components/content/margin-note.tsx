import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

type MarginNoteProps = {
  n: number;
  /** Localised screen-reader prefix, e.g. "Przypis" → announced as "Przypis 1:". */
  srLabel: string;
  children: ReactNode;
};

/**
 * Tufte-style sidenote. On wide screens it floats into the right margin of the
 * ReadingColumn (which is `relative`); below `wide` it renders inline under its
 * paragraph with a thin left rule.
 *
 * Markers are visual only (`aria-hidden`); screen readers hear "Przypis 1: …" once,
 * at the point where the note sits in the text.
 * Phase 4 numbers notes automatically from MDX. TODO(phase-6): stop notes that sit close together from overlapping.
 */
export function MarginNote({ n, srLabel, children }: MarginNoteProps) {
  return (
    <>
      <sup aria-hidden="true" className="ml-0.5 num text-xs text-ink-muted">
        {n}
      </sup>
      <span
        role="note"
        className={cx(
          "my-3 block border-l-2 border-rule pl-3 font-sans text-sm leading-normal text-ink-muted",
          "wide:absolute wide:left-[calc(100%+2.5rem)] wide:my-0 wide:w-56 wide:border-l-0 wide:pl-0",
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

/** The 68ch reading column, with room for margin notes on the right. */
export function ReadingColumn({ children }: { children: ReactNode }) {
  return (
    <div className="reading relative max-w-(--measure) font-serif text-reading text-ink">
      {children}
    </div>
  );
}
