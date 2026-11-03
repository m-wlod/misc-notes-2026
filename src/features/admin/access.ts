/**
 * Who may open which part of the admin panel (Phase 18). One table, read by the proxy
 * (which page a request gets: the panel or a 403) and by the server checks in every
 * admin page, action and API route (the real enforcement, with RLS underneath).
 * Pure, so the e2e 403 sweep can list every route from here.
 */
export type Role = "admin" | "moderator" | "reviewer";

export type Section =
  | "dashboard"
  | "users"
  | "queues"
  | "community"
  | "debunk"
  | "disputes"
  | "content"
  | "exercises"
  | "ai"
  | "flags"
  | "announcements"
  | "social"
  | "system";

const ADMIN: readonly Role[] = ["admin"];
const MODERATION: readonly Role[] = ["admin", "moderator"];
const REVIEW: readonly Role[] = ["admin", "moderator", "reviewer"];

/** Path segment under /[locale]/admin, and who may open it. Same in both locales. */
export const SECTIONS: Record<Section, { segment: string; roles: readonly Role[] }> = {
  dashboard: { segment: "", roles: ADMIN },
  users: { segment: "uzytkownicy", roles: ADMIN },
  queues: { segment: "kolejki", roles: MODERATION },
  community: { segment: "community", roles: MODERATION },
  debunk: { segment: "debunk", roles: MODERATION },
  disputes: { segment: "spory", roles: MODERATION },
  content: { segment: "tresci", roles: REVIEW },
  exercises: { segment: "zadania", roles: REVIEW },
  ai: { segment: "ai", roles: ADMIN },
  flags: { segment: "flagi", roles: ADMIN },
  announcements: { segment: "ogloszenia", roles: ADMIN },
  social: { segment: "social", roles: ADMIN },
  system: { segment: "system", roles: ADMIN },
};

/** The order of the admin navigation. */
export const NAV: readonly Section[] = [
  "dashboard",
  "users",
  "queues",
  "community",
  "debunk",
  "disputes",
  "content",
  "exercises",
  "ai",
  "flags",
  "announcements",
  "social",
  "system",
];

/** API routes under /api/admin/<segment>/… use the same sections. */
const API_SEGMENTS: Record<string, Section> = { users: "users" };

export function canAccess(roles: readonly string[], section: Section): boolean {
  return SECTIONS[section].roles.some((r) => roles.includes(r));
}

export const isStaffRole = (roles: readonly string[]) =>
  (["admin", "moderator", "reviewer"] as const).some((r) => roles.includes(r));

/**
 * The admin section a path belongs to, or null if it isn't an admin path.
 * Unknown admin paths count as the dashboard (admins only): deny by default.
 */
export function sectionFor(pathname: string): Section | null {
  const page = /^\/(?:pl|en)\/admin(?:\/([^/?#]*))?(?=$|[/?#])/.exec(pathname);
  if (page) {
    const seg = page[1] ?? "";
    const found = NAV.find((s) => SECTIONS[s].segment === seg);
    return found ?? "dashboard";
  }
  const api = /^\/api\/admin(?:\/([^/?#]*))?(?=$|[/?#])/.exec(pathname);
  if (api) return API_SEGMENTS[api[1] ?? ""] ?? "dashboard";
  return null;
}

/** Every admin page path (one locale), for the navigation and the 403 sweep. */
export const sectionPath = (section: Section) =>
  SECTIONS[section].segment ? `/admin/${SECTIONS[section].segment}` : "/admin";
