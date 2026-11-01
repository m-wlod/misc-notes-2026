"use server";

import { headers } from "next/headers";
import { redirect as redirectExternal } from "next/navigation";
import { z } from "zod";

import { resolveSiteUrl } from "@/config/runtime";
import { env } from "@/env";
import { getPathname, redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { createClient } from "@/lib/db/server";
import { formText } from "@/lib/form";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | {
      status: "error";
      error: "invalidEmail" | "rateLimited" | "failed" | "notConfigured";
      email: string;
    };

const localeSchema = z.enum(routing.locales);

/** Origin of the current request, so links work on localhost, previews and production alike. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : resolveSiteUrl(env).origin;
}

// Not exported: every export of a "use server" file is a callable endpoint.
async function callbackUrl(locale: Locale, next: string) {
  const url = new URL("/api/auth/callback", await requestOrigin());
  url.searchParams.set("next", next);
  url.searchParams.set("locale", locale);
  return url.href;
}

export async function requestMagicLink(
  _prev: MagicLinkState,
  form: FormData,
): Promise<MagicLinkState> {
  const email = formText(form, "email").trim();
  const locale = localeSchema.catch("pl").parse(form.get("locale"));
  if (!z.email().safeParse(email).success) return { status: "error", error: "invalidEmail", email };

  const supabase = await createClient();
  if (!supabase) return { status: "error", error: "notConfigured", email };

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: await callbackUrl(locale, getPathname({ href: "/profile", locale })),
      data: { locale }, // read by the signup trigger to set profiles.locale
    },
  });
  if (error) {
    return { status: "error", error: error.status === 429 ? "rateLimited" : "failed", email };
  }
  return { status: "sent", email };
}

export async function signInWithProvider(form: FormData) {
  const provider = z.enum(["google", "github"]).parse(form.get("provider"));
  const locale = localeSchema.catch("pl").parse(form.get("locale"));
  const supabase = await createClient();
  if (!supabase)
    return redirect({ href: { pathname: "/sign-in", query: { error: "notConfigured" } }, locale });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: await callbackUrl(locale, getPathname({ href: "/profile", locale })) },
  });
  if (error)
    return redirect({ href: { pathname: "/sign-in", query: { error: "failed" } }, locale });
  // The provider's consent screen is an external URL, so use the plain Next redirect.
  redirectExternal(data.url);
}

export async function signOut(form: FormData) {
  const locale = localeSchema.catch("pl").parse(form.get("locale"));
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect({ href: "/", locale });
}
