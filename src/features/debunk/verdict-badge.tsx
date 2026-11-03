import { useTranslations } from "next-intl";

import { cx } from "@/lib/cx";

/** The verdict as a word with a symbol, so it never depends on colour alone (Phase 16). */
const SYMBOL = { false: "✕", misleading: "!", "true-but-irrelevant": "≈", depends: "?" } as const;
const TONE = {
  false: "border-wrong text-wrong",
  misleading: "border-accent text-accent-text",
  "true-but-irrelevant": "border-rule-strong text-ink",
  depends: "border-rule-strong text-ink",
} as const;

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: keyof typeof SYMBOL;
  className?: string;
}) {
  const t = useTranslations("debunk.verdict");
  return (
    <span
      data-verdict-badge={verdict}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-sans text-xs font-semibold",
        TONE[verdict],
        className,
      )}
    >
      <span aria-hidden="true">{SYMBOL[verdict]}</span>
      {t(verdict)}
    </span>
  );
}
