"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { shouldAsk } from "./consent";
import { useConsent } from "./use-consent";

/**
 * The consent banner (Phase 21b). It appears only when something that needs consent is
 * configured (analytics: `NEXT_PUBLIC_POSTHOG_KEY`) and the visitor hasn't chosen yet.
 * Both answers are one click and equally prominent; essential storage needs no consent.
 */
export function ConsentBanner({ analyticsConfigured }: { analyticsConfigured: boolean }) {
  const t = useTranslations("consent");
  const [consent, save] = useConsent();
  // After hydration only: the server can't know the stored choice (no flash for people
  // who already chose).
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  if (!hydrated || !shouldAsk(consent, analyticsConfigured)) return null;
  return (
    <section
      aria-labelledby="consent-title"
      data-consent-banner
      className="fixed inset-x-0 bottom-0 z-(--z-toast) border-t border-rule-strong bg-surface px-4 py-4 font-sans sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 id="consent-title" className="text-sm font-medium text-ink">
            {t("banner.title")}
          </h2>
          <p className="text-sm text-ink-muted">
            {t("banner.body")}{" "}
            <Link href="/cookies" className="underline">
              {t("banner.settings")}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              save({ analytics: false });
            }}
          >
            {t("banner.essential")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              save({ analytics: true });
            }}
          >
            {t("banner.accept")}
          </Button>
        </div>
      </div>
    </section>
  );
}

const noSubscribe = () => () => undefined;

/** The settings on the cookies page: essential (always on), analytics, videos. */
export function ConsentSettings({ analyticsConfigured }: { analyticsConfigured: boolean }) {
  const t = useTranslations("consent");
  const [consent, save] = useConsent();
  const [saved, setSaved] = useState(false);
  const id = useId();
  const row = (name: "essential" | "analytics" | "embeds", checked: boolean, locked = false) => (
    <div className="flex items-start gap-3 py-3">
      <input
        id={`${id}-${name}`}
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={locked}
        onChange={(e) => {
          if (name !== "essential") {
            save({ [name]: e.target.checked });
            setSaved(true);
          }
        }}
      />
      <label htmlFor={`${id}-${name}`} className="grid gap-0.5">
        <span className="text-base text-ink">{t(`settings.${name}.label`)}</span>
        <span className="text-sm text-ink-muted">{t(`settings.${name}.hint`)}</span>
      </label>
    </div>
  );
  return (
    <section
      aria-labelledby={`${id}-title`}
      data-consent-settings
      className="my-8 max-w-(--measure) rounded-md border border-rule-strong px-4 py-3 font-sans"
    >
      <h2 id={`${id}-title`} className="mb-1 text-lg">
        {t("settings.title")}
      </h2>
      <p className="text-sm text-ink-muted">{t("settings.lead")}</p>
      <div className="divide-y divide-rule">
        {row("essential", true, true)}
        {row("analytics", consent.analytics)}
        {row("embeds", consent.embeds)}
      </div>
      {analyticsConfigured ? null : (
        <p className="text-xs text-ink-muted">{t("settings.analyticsOff")}</p>
      )}
      <p role="status" className="min-h-5 text-sm text-ink">
        {saved ? t("settings.saved") : ""}
      </p>
    </section>
  );
}
