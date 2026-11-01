import type { ReactNode } from "react";

import { SidenoteToggle } from "./sidenote-toggle";

type MarginNoteProps = {
  n: number;
  /** Localised screen-reader prefix, e.g. "Przypis" → announced as "Przypis 1:". */
  srLabel: string;
  /** Accessible name of the phone toggle, e.g. "Przypis 1". Defaults to `${srLabel} ${n}`. */
  buttonLabel?: string;
  children: ReactNode;
};

/**
 * Tufte-style sidenote: in the right margin of the ReadingColumn (which is `relative`) on
 * wide screens; below `wide` the number is a button that expands the note inline
 * (SidenoteToggle). Screen readers hear "Przypis 1: …" where the note sits in the text.
 * Numbers come from MDX at build time.
 * TODO(content): stop notes that sit close together from overlapping in the margin.
 */
export function MarginNote({ n, srLabel, buttonLabel, children }: MarginNoteProps) {
  return (
    <SidenoteToggle n={n} srLabel={srLabel} buttonLabel={buttonLabel ?? `${srLabel} ${String(n)}`}>
      {children}
    </SidenoteToggle>
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
