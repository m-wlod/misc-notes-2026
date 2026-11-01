/**
 * Where to send the user after the auth callback. Only same-site, locale-prefixed paths
 * are allowed, so `?next=` can't be used as an open redirect (//evil.com, https://…,
 * /\evil.com, javascript:, …). Anything else falls back to `fallback`.
 */
export function safeNext(next: string | null, fallback: string): string {
  if (!next) return fallback;
  if (!/^\/(pl|en)(\/[A-Za-z0-9\-._~/]*)?(\?[A-Za-z0-9\-._~=&%]*)?$/.test(next)) return fallback;
  if (next.includes("//") || next.includes("\\")) return fallback;
  return next;
}

/** The locale implied by a path like /en/…, defaulting to Polish. */
export function localeOfPath(path: string): "pl" | "en" {
  return path.startsWith("/en") ? "en" : "pl";
}
