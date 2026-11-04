import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { isInternalPath, isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { canAccess, sectionFor } from "@/features/admin/access";
import { curriculumRoute } from "@/features/curriculum/slug-redirect";
import { LEARNER_COOKIE } from "@/features/grading/random";
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
 * 2c. Learner id for randomised exercises (qla_sid): random bytes, httpOnly, one year.
 *    It only seeds exercise numbers; it identifies no one.
 * 3. Supabase session refresh: keeps the auth cookie fresh. It makes no access
 *    decisions; pages and server actions check the user themselves.
 * 4. Admin paths (and internal tools in production) read the user's roles to choose
 *    between the page and a 403. The pages, actions and API routes enforce it again.
 */
export async function proxy(request: NextRequest) {
  // Decoded, so "/pl/%61dmin" can't slip past the gates below (pentest L1); the pages
  // check access again anyway. A malformed escape is left as is (the router 400s it).
  const pathname = safeDecode(request.nextUrl.pathname);
  // Internal tools: open in development and previews; in production for admins only.
  if (isInternalPath(pathname) && !isStyleguideEnabled(env)) {
    const roles = await rolesOf(request);
    if (!roles.includes("admin")) return new NextResponse(null, { status: 404 });
  }

  // 4. Admin panel (Phase 18): who gets the panel and who gets a 403. This only picks
  //    the page; every admin page, action and API route checks the role again itself.
  const section = sectionFor(pathname);
  if (section && !canAccess(await rolesOf(request), section)) {
    return forbidden(request);
  }

  const route = curriculumRoute(request.nextUrl.pathname);
  if (route === "missing") {
    // The localised 404 page (catch-all route), with a real 404 status.
    const locale = request.nextUrl.pathname.split("/")[1] ?? routing.defaultLocale;
    return NextResponse.rewrite(new URL(`/${locale}/404-not-found`, request.url));
  }
  if (route) return NextResponse.redirect(new URL(route.redirect, request.url), 308);

  const response = handleI18nRouting(request);
  if (!request.cookies.has(LEARNER_COOKIE)) {
    response.cookies.set(LEARNER_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  await refreshSupabaseSession(request, response);
  return response;
}

/**
 * The localised 403 page with a real 403 status. A rewrite can't carry a status code,
 * so the proxy fetches the page (static, prerendered) and returns it as a 403.
 */
async function forbidden(request: NextRequest): Promise<NextResponse> {
  const locale = request.nextUrl.pathname.split("/")[1] === "en" ? "en" : routing.defaultLocale;
  const path = locale === "en" ? "/en/forbidden" : "/pl/brak-dostepu";
  const page = await fetch(new URL(path, request.url), {
    headers: { "accept-language": locale },
  }).catch(() => null);
  return new NextResponse(page?.ok ? await page.text() : "403 Forbidden", {
    status: 403,
    headers: {
      "content-type": page?.ok ? "text/html; charset=utf-8" : "text/plain; charset=utf-8",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}

/**
 * The signed-in user's roles (own rows of `user_roles`, readable by RLS), or none when
 * signed out or without a database. Only called for admin and internal paths.
 */
async function rolesOf(request: NextRequest): Promise<string[]> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return [];
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return [];
  const { data: rows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  return (rows ?? []).map((r: { role: string }) => r.role);
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

function safeDecode(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
