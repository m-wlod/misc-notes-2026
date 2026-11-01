import type { ReactNode } from "react";

type FigureFrameProps = {
  /** Display number, e.g. "3.2". Phase 4 numbers figures automatically. */
  number: string;
  /** Localised prefix, e.g. "Rys." (pl) or "Fig." (en). */
  prefix: string;
  /** Parameters line shown top-right in mono, e.g. "μ = 0 · σ = 1% · seed 7". */
  meta?: ReactNode;
  caption: ReactNode;
  children: ReactNode;
};

export function FigureFrame({ number, prefix, meta, caption, children }: FigureFrameProps) {
  return (
    <figure className="my-9">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold tracking-[0.04em] text-ink uppercase">
          {prefix} {number}
        </span>
        {meta ? <span className="num text-2xs text-ink-muted">{meta}</span> : null}
      </div>
      {children}
      <figcaption className="mt-2.5 font-sans text-sm text-ink-muted">{caption}</figcaption>
    </figure>
  );
}
