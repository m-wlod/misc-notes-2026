"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cx } from "@/lib/cx";

import { isActive, MOBILE_NAV, PRIMARY_NAV } from "./nav-items";

/** Top-bar section links (hidden below 640px, where the bottom bar takes over). */
export function PrimaryNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("primary")} className="hidden sm:block">
      <ul className="flex gap-6">
        {PRIMARY_NAV.map(({ key, href }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "block border-b-2 py-[17px] text-sm transition-[color,border-color]",
                  active
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Fixed bottom bar on phones: four sections plus the profile, text only. */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("mobile")}
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-rule bg-bg pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_NAV.map(({ key, href }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-14 items-center justify-center border-t-2 px-1 text-center text-xs leading-tight",
                  active
                    ? "border-accent font-medium text-ink"
                    : "border-transparent text-ink-muted",
                )}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
