import type { ReactNode } from "react";

type EquationBlockProps = {
  number: string;
  /** Localised accessible name for the scroll region, e.g. "Równanie (4.1)". */
  label: string;
  children: ReactNode;
};

/**
 * Numbered display equation between two hairlines. Long equations scroll inside the
 * block (keyboard-focusable), never the page. Phase 4 renders KaTeX (MathML) into
 * `children` and numbers equations automatically.
 */
export function EquationBlock({ number, label, children }: EquationBlockProps) {
  return (
    <div className="relative my-7 flex items-center border-y border-rule py-3.5">
      {/* A focusable scroll region so keyboard users can scroll long equations (WCAG 2.1.1). */}
      <div
        role="group"
        aria-label={label}
        tabIndex={0}
        className="min-w-0 flex-1 overflow-x-auto text-center"
      >
        {children}
      </div>
      <span aria-hidden="true" className="shrink-0 pl-4 num text-sm text-ink-muted">
        ({number})
      </span>
    </div>
  );
}
