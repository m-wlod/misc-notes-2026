/**
 * UTM handling (Phase 19), pure. Campaign links from TikTok and YouTube carry
 * `utm_source`, `utm_medium` and `utm_campaign`; the site counts landings per day with
 * them (our own counter: no cookies, no user id, no IP stored).
 */
export type Utm = { source: string; medium: string; campaign: string };

const VALUE = /^[a-z0-9][a-z0-9._-]{0,39}$/;

/** Lower case, trimmed, spaces to hyphens; anything else outside the charset is refused. */
function clean(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase().replace(/\s+/g, "-");
  return VALUE.test(v) ? v : null;
}

/** The campaign of a landing, or null without a valid `utm_source`. */
export function parseUtm(search: URLSearchParams | string): Utm | null {
  const q = typeof search === "string" ? new URLSearchParams(search) : search;
  const source = clean(q.get("utm_source"));
  if (!source) return null;
  return {
    source,
    medium: clean(q.get("utm_medium")) ?? "",
    campaign: clean(q.get("utm_campaign")) ?? "",
  };
}

export const hasUtm = (search: URLSearchParams | string) =>
  [...(typeof search === "string" ? new URLSearchParams(search) : search).keys()].some((k) =>
    k.startsWith("utm_"),
  );

/** The query without its `utm_*` params ("" when nothing is left). */
export function withoutUtm(search: string): string {
  const q = new URLSearchParams(search);
  for (const k of [...q.keys()]) if (k.startsWith("utm_")) q.delete(k);
  const rest = q.toString();
  return rest ? `?${rest}` : "";
}

/** A landing path as counted: the path only, no query, at most 120 characters. */
export function landingPath(pathname: string): string | null {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  const p = pathname.split(/[?#]/)[0] ?? "/";
  return /^[\w\-./%]{1,120}$/.test(p) ? p : null;
}

/** Adds campaign params to a site path or URL, keeping any query it already has. */
export function withUtm(href: string, utm: Utm): string {
  const [path, query = ""] = href.split("?") as [string, string?];
  const q = new URLSearchParams(query);
  q.set("utm_source", utm.source);
  if (utm.medium) q.set("utm_medium", utm.medium);
  if (utm.campaign) q.set("utm_campaign", utm.campaign);
  return `${path}?${q.toString()}`;
}

/** Where a link-in-bio visitor came from (`/links?src=…`); "bio" when unknown. */
export const BIO_SOURCES = ["tiktok", "youtube", "instagram", "x", "facebook"] as const;
export function bioSource(src: string | string[] | undefined): string {
  const v = Array.isArray(src) ? src[0] : src;
  return (BIO_SOURCES as readonly string[]).includes(v ?? "") ? (v as string) : "bio";
}
