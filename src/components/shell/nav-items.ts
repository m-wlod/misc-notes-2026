import type { StaticPathname } from "@/i18n/routing";

/** The four learning sections, in the order they appear in the top bar. */
export const PRIMARY_NAV = [
  { key: "learn", href: "/learn" },
  { key: "practice", href: "/practice" },
  { key: "interview", href: "/interview" },
  { key: "debunk", href: "/debunk" },
] as const satisfies readonly { key: string; href: StaticPathname }[];

/** Mobile bottom bar: the four sections plus the profile. */
export const MOBILE_NAV = [...PRIMARY_NAV, { key: "profile", href: "/profile" }] as const;

export const LEGAL_NAV = [
  { key: "privacy", href: "/privacy" },
  { key: "terms", href: "/terms" },
  { key: "cookies", href: "/cookies" },
  { key: "disclaimer", href: "/disclaimer" },
] as const satisfies readonly { key: string; href: StaticPathname }[];

export const MORE_NAV = [
  { key: "textbook", href: "/textbook" },
  { key: "notes", href: "/notes" },
  { key: "glossary", href: "/glossary" },
  { key: "lab", href: "/lab" },
  { key: "about", href: "/about" },
  { key: "settings", href: "/settings" },
] as const satisfies readonly { key: string; href: StaticPathname }[];

/** Is `href` the current page or one of its subpages? */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
