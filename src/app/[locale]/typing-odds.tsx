"use client";

import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { formatOdds, randomTypingOdds, TYPING_ALPHABET } from "@/lib/i18n/odds";

/** "Chance of landing here by typing at random: 1 in 2.2·10³⁶", for the URL actually typed. */
export function TypingOdds() {
  const t = useTranslations("errors.notFound");
  const locale = useLocale();
  const odds = randomTypingOdds(decodeURIComponent(usePathname()));
  return (
    <figure className="max-w-(--measure) border-y border-rule py-4">
      <p className="text-base text-ink">{t("odds", { odds: formatOdds(odds, locale) })}</p>
      <figcaption className="mt-1 num text-xs text-ink-muted">
        {t("assumption", { alphabet: TYPING_ALPHABET, length: odds.length })}
      </figcaption>
    </figure>
  );
}
