import type { ReactNode } from "react";

/**
 * Numbered display equation between two hairlines. Long equations scroll inside the
 * block, never the page. Phase 4 renders KaTeX (MathML) into `children` and numbers
 * equations automatically; until then children are any node.
 */
export function EquationBlock({ number, children }: { number: string; children: ReactNode }) {
  return (
    <div className="relative my-7 flex items-center border-y border-rule py-3.5">
      <div className="min-w-0 flex-1 overflow-x-auto text-center">{children}</div>
      <span className="shrink-0 pl-4 num text-sm text-ink-muted">({number})</span>
    </div>
  );
}
