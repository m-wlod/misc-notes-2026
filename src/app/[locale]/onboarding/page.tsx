import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { requireUser } from "@/features/account/require-user";
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/onboarding">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "onboarding" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function OnboardingPage({ params }: PageProps<"/[locale]/onboarding">) {
  const t = await getTranslations("onboarding");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-8 text-3xl">{t("metaTitle")}</h1>
      <Suspense fallback={<Skeleton className="h-64 max-w-(--measure)" />}>
        <Flow params={params} />
      </Suspense>
    </div>
  );
}

async function Flow({ params }: { params: PageProps<"/[locale]/onboarding">["params"] }) {
  const { profile } = await requireUser((await params).locale as Locale);
  return (
    <OnboardingFlow
      initial={{
        goal:
          (profile.goal as "trading" | "interviews" | "university" | "curiosity" | null) ?? null,
        self_level: profile.self_level,
        daily_goal_minutes: profile.daily_goal_minutes,
      }}
    />
  );
}
