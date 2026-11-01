import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { isInternalPath, isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { curriculumRoute } from "@/features/curriculum/slug-redirect";
import { routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

/**
 * Next.js 16 proxy (formerly middleware). Per CLAUDE.md it only redirects, rewrites,
 * hides routes or refreshes cookies; authorization always lives in RLS and server code.
 *
 * 1. Hide internal tools (style guide, /dev) outside development and previews (review M11).
 * 2. Track/module slugs from the other language redirect to this language's (308);
 *    unknown ones get the 404 page with a real 404 status.
 * 2b. Locale routing (next-intl): prefix-less URLs redirect to /pl or /en using the
 *    NEXT_LOCALE cookie, then Accept-Language, then Polish.
 * 3. Supabase session refresh: keeps the auth cookie fresh. It makes no access
 *    decisions; pages and server actions check the user themselves.
 */
export async function proxy(request: NextRequest) {
  if (isInternalPath(request.nextUrl.pathname) && !isStyleguideEnabled(env)) {
    return new NextResponse(null, { status: 404 });
  }

  const route = curriculumRoute(request.nextUrl.pathname);
  if (route === "missing") {
    // The localised 404 page (catch-all route), with a real 404 status.
    const locale = request.nextUrl.pathname.split("/")[1] ?? routing.defaultLocale;
    return NextResponse.rewrite(new URL(`/${locale}/404-not-found`, request.url));
  }
  if (route) return NextResponse.redirect(new URL(route.redirect, request.url), 308);

  const response = handleI18nRouting(request);
  await refreshSupabaseSession(request, response);
  return response;
}

async function refreshSupabaseSession(request: NextRequest, response: NextResponse) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Skip the network round-trip for visitors who have never signed in.
  if (!url || !key || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  // getUser() validates the token with the auth server and refreshes it when needed.
  await supabase.auth.getUser();
}

export const config = {
  // Everything except API routes, Next internals, Vercel internals and files with an extension.
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
