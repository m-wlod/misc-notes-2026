import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { requireUser } from "@/features/account/require-user";
import { SettingsForm } from "@/features/account/settings-form";
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
  const { profile } = await requireUser((await params).locale as Locale);
  return (
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
  );
}
