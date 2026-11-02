import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { env } from "@/env";
import { requireUser } from "@/features/account/require-user";
import { SettingsForm } from "@/features/account/settings-form";
import { NotificationSettings } from "@/features/notify/notification-settings";
import { DEFAULT_PREFS } from "@/features/notify/rules";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "account.settings" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function SettingsPage({ params }: PageProps<"/[locale]/settings">) {
  const t = await getTranslations("account.settings");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-10 text-3xl">{t("metaTitle")}</h1>
      <Suspense fallback={<Skeleton className="h-96 max-w-xl" />}>
        <Body params={params} />
      </Suspense>
    </div>
  );
}

async function Body({ params }: { params: PageProps<"/[locale]/settings">["params"] }) {
  const { profile, supabase, user } = await requireUser((await params).locale as Locale);
  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return (
    <div className="grid gap-12">
      <SettingsForm
        profile={{
          display_name: profile.display_name,
          handle: profile.handle,
          locale: profile.locale,
          daily_goal_minutes: profile.daily_goal_minutes,
          timezone: profile.timezone,
          is_public: profile.is_public,
          league_opt_out: profile.league_opt_out,
        }}
      />
      <NotificationSettings
        vapidKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
        initial={{
          streak: prefs?.email_streak ?? DEFAULT_PREFS.streak,
          weekly: prefs?.email_weekly ?? DEFAULT_PREFS.weekly,
          league: prefs?.email_league ?? DEFAULT_PREFS.league,
          push: prefs?.push_enabled ?? false,
          quietStart: prefs?.quiet_start?.slice(0, 5) ?? null,
          quietEnd: prefs?.quiet_end?.slice(0, 5) ?? null,
        }}
      />
    </div>
  );
}
