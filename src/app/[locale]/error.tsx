"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Calm error boundary: no stack trace for users (Sentry gets it in Phase 22). */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.error");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-16 pb-16 sm:px-6">
      <h1 className="mb-4 text-3xl">{t("title")}</h1>
      <p className="mb-8 max-w-(--measure) font-serif text-reading">{t("body")}</p>
      <Button
        onClick={() => {
          reset();
        }}
      >
        {t("retry")}
      </Button>
    </div>
  );
}
