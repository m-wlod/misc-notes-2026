"use client";

import { useLocale, useTranslations } from "next-intl";

import { usePathname } from "@/i18n/navigation";
import { cx } from "@/lib/cx";

import { sectionPath, type Section } from "../access";

/**
 * The admin navigation (Phase 18): only the sections the viewer's roles open. Admin
 * paths are the same in both locales, so plain links with the locale prefix.
 */
export function AdminNav({ sections }: { sections: Section[] }) {
  const t = useTranslations("admin.nav");
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="font-sans text-sm">
      <ul className="flex flex-wrap gap-1 lg:grid lg:gap-0.5">
        {sections.map((s) => {
          const path = sectionPath(s);
          const current = s === "dashboard" ? pathname === path : pathname.startsWith(path);
          return (
            <li key={s}>
              <a
                href={`/${locale}${path}`}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "block rounded px-2 py-1 text-ink-muted no-underline hover:bg-sunken hover:text-ink",
                  current && "bg-sunken text-ink",
                )}
              >
                {t(s)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
