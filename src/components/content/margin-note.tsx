import type { ReactNode } from "react";

/**
 * Tufte-style sidenote. On wide screens it floats into the right margin of the
 * reading column (the parent must be `relative`, see ReadingColumn); below `wide`
 * it renders inline under its paragraph with a thin left rule.
 *
 * Phase 4 wires numbering automatically from MDX; here `n` is passed explicitly.
 */
export function MarginNote({ n, children }: { n: number; children: ReactNode }) {
  return (
    <>
      <sup className="ml-0.5 num text-[0.6em] text-accent-text">{n}</sup>
      <span
        role="note"
        className={[
          "my-3 block border-l-2 border-rule pl-3 font-sans text-sm leading-normal text-ink-muted",
          "wide:absolute wide:left-[calc(100%+2.5rem)] wide:my-0 wide:w-56 wide:border-l-0 wide:pl-0",
        ].join(" ")}
      >
        <sup className="mr-1 num text-accent-text">{n}</sup>
        {children}
      </span>
    </>
  );
}

/** The 68ch reading column, with room for margin notes on the right. */
export function ReadingColumn({ children }: { children: ReactNode }) {
  return (
    <div className="relative max-w-(--measure) font-serif text-reading text-ink [&_p]:mb-[1em]">
      {children}
    </div>
  );
}
