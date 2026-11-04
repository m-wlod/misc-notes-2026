/**
 * Security headers for every response (Phase 21). Pure, so it is unit-tested and used by
 * next.config.ts.
 *
 * The Content-Security-Policy allows inline scripts: the pages are prerendered (static
 * shells with streamed parts), and Next's inline bootstrap scripts can only carry a
 * nonce on pages rendered per request, which would make every page dynamic. Everything
 * else is locked down: scripts only from this origin (plus jsDelivr, where Pyodide comes
 * from), no plugins, no framing of this site, forms post only here, and the only frames
 * are the click-to-load YouTube (no-cookie) and TikTok players.
 */
export function contentSecurityPolicy({
  supabaseUrl,
  sentryDsn,
  dev,
}: {
  supabaseUrl?: string | undefined;
  /** Error reports go to the DSN's ingest host (Phase 22a), when Sentry is configured. */
  sentryDsn?: string | undefined;
  dev: boolean;
}): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : null;
  const sentry = sentryDsn ? new URL(sentryDsn).origin : null;
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'wasm-unsafe-eval': Pyodide (WebAssembly). 'unsafe-eval' only for the dev server.
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      "'wasm-unsafe-eval'",
      "https://cdn.jsdelivr.net",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    // KaTeX and component styles set inline styles.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "https://cdn.jsdelivr.net",
      ...(supabase ? [supabase] : []),
      ...(supabaseWs ? [supabaseWs] : []),
      ...(sentry ? [sentry] : []),
      ...(dev ? ["ws:"] : []),
    ],
    "frame-src": ["https://www.youtube-nocookie.com", "https://www.tiktok.com"],
    "worker-src": ["'self'", "blob:"],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
  };
  const policy = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders(opts: {
  supabaseUrl?: string | undefined;
  sentryDsn?: string | undefined;
  dev: boolean;
}): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(opts) },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-Frame-Options", value: "DENY" },
  ];
}
