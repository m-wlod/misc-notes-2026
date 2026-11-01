import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

const STYLEGUIDE = /^\/(?:(?:pl|en)\/)?styleguide(?:\/|$)/;

/**
 * Next.js 16 proxy (formerly middleware). Per CLAUDE.md it only redirects, rewrites or
 * hides routes; authorization always lives in RLS and server code.
 *
 * 1. Hide the internal style guide outside development and previews (review M11).
 * 2. Locale routing (next-intl): prefix-less URLs redirect to /pl or /en using the
 *    NEXT_LOCALE cookie, then Accept-Language, then Polish. Visiting a prefixed URL
 *    stores that locale in the cookie, so a manual language switch is remembered.
 */
export function proxy(request: NextRequest) {
  if (STYLEGUIDE.test(request.nextUrl.pathname) && !isStyleguideEnabled(env)) {
    return new NextResponse(null, { status: 404 });
  }
  return handleI18nRouting(request);
}

export const config = {
  // Everything except API routes, Next internals, Vercel internals and files with an extension.
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
