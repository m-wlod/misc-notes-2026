import type { Metadata } from "next";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { verifyCertificate } from "@/features/certificates/server";
import type { Locale } from "@/i18n/routing";

import { curriculum } from "../../../../../content/curriculum";

type Props = PageProps<"/[locale]/verify/[id]">;

/**
 * Certificates are created at runtime, so no real ids exist at build. One placeholder
 * id lets the build prerender the page shell; every real id renders at request time.
 */
export function generateStaticParams() {
  return [{ id: "example" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "certificates" });
  return { title: t("verify.title"), robots: { index: false } };
}

/** Public certificate check (Phase 15): valid or not found, and what it means. */
export default async function VerifyPage({ params }: Props) {
  const t = await getTranslations("certificates");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-6 text-3xl">{t("verify.title")}</h1>
      <Suspense fallback={<Skeleton className="h-40 max-w-xl" />}>
        <Result params={params} />
      </Suspense>
    </div>
  );
}

async function Result({ params }: Pick<Props, "params">) {
  await connection();
  const { locale: raw, id } = await params;
  const locale = raw === "en" ? "en" : "pl";
  const t = await getTranslations("certificates");
  const format = await getFormatter();
  const cert = await verifyCertificate(id);
  if (!cert) {
    return (
      <div data-verify="not-found" className="grid max-w-(--measure) gap-3">
        <p className="text-lg text-wrong">{t("verify.notFound")}</p>
        <p className="font-sans text-sm text-ink-muted">{t("verify.notFoundNote")}</p>
      </div>
    );
  }
  const track = curriculum.find((c) => c.id === cert.trackId);
  return (
    <div data-verify="valid" className="grid max-w-(--measure) gap-3">
      <p className="text-lg text-correct">{t("verify.valid")}</p>
      <dl className="grid gap-x-8 gap-y-2 border-y border-rule py-4 sm:grid-cols-[10rem_1fr]">
        <dt className="text-sm text-ink-muted">{t("verify.name")}</dt>
        <dd>{cert.name}</dd>
        <dt className="text-sm text-ink-muted">{t("verify.track")}</dt>
        <dd>{track?.name[locale] ?? cert.trackId}</dd>
        <dt className="text-sm text-ink-muted">{t("verify.date")}</dt>
        <dd>{format.dateTime(new Date(cert.issuedAt), { dateStyle: "long" })}</dd>
      </dl>
      <p className="font-sans text-sm">
        <a href={`/api/certificates/${id}/pdf?lang=${locale}`}>{t("verify.pdf")}</a>
      </p>
      <p className="font-sans text-xs text-ink-muted">{t("disclaimer")}</p>
    </div>
  );
}
