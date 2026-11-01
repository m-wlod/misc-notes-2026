import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { alternatesFor } from "@/components/shell/section-page";
import { env } from "@/env";
import { SignInForm } from "@/features/auth/sign-in-form";
import type { Locale } from "@/i18n/routing";
import { isSupabaseConfigured } from "@/lib/db/config";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: alternatesFor("/sign-in", locale),
  };
}

export default async function SignInPage({ searchParams }: PageProps<"/[locale]/sign-in">) {
  const t = await getTranslations("auth");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-4 text-3xl">{t("title")}</h1>
      {isSupabaseConfigured() ? (
        <>
          <p className="mb-8 max-w-(--measure) font-serif text-reading">{t("lead")}</p>
          <Suspense>
            <Form searchParams={searchParams} />
          </Suspense>
        </>
      ) : (
        <p
          role="note"
          className="max-w-(--measure) border-l-2 border-rule-strong py-1 pl-5 text-base"
        >
          {t("notConfigured")}
        </p>
      )}
    </div>
  );
}

async function Form({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/sign-in">["searchParams"];
}) {
  const { error } = await searchParams;
  return (
    <SignInForm providers={env.NEXT_PUBLIC_AUTH_PROVIDERS} callbackError={error === "callback"} />
  );
}
