"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { ThemeSwitch } from "@/components/theme/theme-switch";
import { SearchIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type AppPathname } from "@/i18n/routing";
import { cx } from "@/lib/cx";

export function ThemeControl() {
  const t = useTranslations("common.theme");
  return (
    <ThemeSwitch
      labels={{ group: t("group"), system: t("system"), light: t("light"), dark: t("dark") }}
    />
  );
}

/**
 * Links to the same page in the other locale (/pl/nauka ↔ /en/learn). Visiting it
 * updates the NEXT_LOCALE cookie in the proxy, so the choice is remembered.
 */
export function LocaleSwitch({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("common.language");
  const locale = useLocale();
  // Unknown paths (404) fall back to the home page in the other language. Dynamic routes
  // (e.g. /learn/[track]) keep their params; the page then redirects a slug from the
  // other language to its own (src/app/[locale]/learn/[track]/page.tsx).
  const pathname = usePathname();
  const params = useParams();
  const known: AppPathname = pathname in routing.pathnames ? pathname : "/";
  const dynamicParams = Object.fromEntries(
    Object.entries(params).filter(([key, value]) => key !== "locale" && typeof value === "string"),
  );
  const href = (
    known.includes("[") ? { pathname: known, params: dynamicParams } : known
  ) as ComponentProps<typeof Link>["href"];

  return (
    <ul aria-label={t("label")} className="flex items-center gap-3 text-sm">
      {routing.locales.map((l) =>
        l === locale ? (
          <li key={l} aria-current="true" className="text-ink">
            {compact ? l.toUpperCase() : t(l)}
          </li>
        ) : (
          <li key={l}>
            <Link
              href={href}
              locale={l}
              lang={l}
              hrefLang={l}
              className={cx("text-ink-muted underline-offset-4 hover:text-ink hover:underline")}
            >
              {compact ? l.toUpperCase() : t(l)}
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}

/** Search arrives in Phase 5; until then the button says so instead of pretending. */
export function SearchButton() {
  const t = useTranslations("common.search");
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("label")}
        className="flex size-9 items-center justify-center rounded text-ink-muted hover:bg-sunken hover:text-ink"
      >
        <SearchIcon />
      </PopoverTrigger>
      <PopoverContent label={t("label")} align="end">
        {t("comingSoon")}
      </PopoverContent>
    </Popover>
  );
}
