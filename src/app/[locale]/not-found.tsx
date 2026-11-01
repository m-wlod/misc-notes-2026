import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { TypingOdds } from "./typing-odds";

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-16 pb-16 sm:px-6">
      <p className="mb-3 num text-xs text-ink-muted">404</p>
      <h1 className="mb-4 text-3xl">{t("title")}</h1>
      <p className="mb-8 max-w-(--measure) font-serif text-reading">{t("body")}</p>
      <TypingOdds />
      <Link href="/" className="mt-10 inline-block text-accent-text underline underline-offset-4">
        {t("home")}
      </Link>
    </div>
  );
}
