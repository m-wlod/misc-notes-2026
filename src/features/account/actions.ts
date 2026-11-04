"use server";

import { redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { createAdminClient } from "@/lib/db/admin";
import { updateMyProfile } from "@/lib/db/profile";
import { getSession } from "@/lib/db/session";
import { formText } from "@/lib/form";
import { allowWrite } from "@/lib/rate/write";

export type SettingsState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; error: "invalid" | "handleTaken" | "failed" };

const asLocale = (v: FormDataEntryValue | null): Locale => (v === "en" ? "en" : "pl");

/** Saves the settings form. Validation is server-side (profileUpdateSchema); RLS: own row. */
export async function saveSettings(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const currentLocale = asLocale(form.get("currentLocale"));
  const locale = asLocale(form.get("locale"));
  const displayName = formText(form, "display_name").trim();
  const session = await getSession();
  if (session && !(await allowWrite("settings", session.user.id))) {
    return { status: "error", error: "failed" };
  }

  const result = await updateMyProfile({
    display_name: displayName === "" ? null : displayName,
    handle: formText(form, "handle").trim().toLowerCase(),
    locale,
    daily_goal_minutes: Number(form.get("daily_goal_minutes")),
    timezone: formText(form, "timezone"),
    is_public: form.get("is_public") === "on",
    league_opt_out: form.get("league_opt_out") === "on",
  });

  if (!result.ok) {
    if (result.error === "signed-out" || result.error === "not-configured")
      redirect({ href: "/sign-in", locale: currentLocale });
    return {
      status: "error",
      error:
        result.error === "handle-taken"
          ? "handleTaken"
          : result.error === "invalid"
            ? "invalid"
            : "failed",
    };
  }
  // A new language: continue on the settings page in that language (this also updates
  // the NEXT_LOCALE cookie in the proxy).
  if (locale !== currentLocale && routing.locales.includes(locale))
    redirect({ href: "/settings", locale });
  return { status: "saved" };
}

export type DeleteState =
  { status: "idle" } | { status: "error"; error: "confirmMismatch" | "failed" };

/**
 * Deletes the signed-in user's account. The user must type their handle. Deletion uses
 * the secret key (users can't delete auth records themselves); ON DELETE CASCADE removes
 * private rows and comments are anonymised (see migrations).
 */
export async function deleteAccount(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  const locale = asLocale(form.get("locale"));
  const session = await getSession();
  if (!session) redirect({ href: "/sign-in", locale });
  const { supabase, user } = session as NonNullable<typeof session>;
  if (!(await allowWrite("deleteAccount", user.id))) return { status: "error", error: "failed" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", user.id)
    .single();
  const typed = formText(form, "confirm").trim().toLowerCase();
  if (!profile || typed !== profile.handle.toLowerCase())
    return { status: "error", error: "confirmMismatch" };

  const admin = createAdminClient();
  if (!admin) return { status: "error", error: "failed" };
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { status: "error", error: "failed" };

  await supabase.auth.signOut();
  redirect({ href: "/", locale });
  return { status: "idle" };
}
