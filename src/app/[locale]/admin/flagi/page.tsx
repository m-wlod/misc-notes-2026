import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { requirePage } from "@/features/admin/server";
import { FlagRowForm, NewFlagForm } from "@/features/admin/ui/platform-forms";

/** Feature flags (Phase 18c): on/off, rollout share, description; audited. */
export default function AdminFlagsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Flags />
    </Suspense>
  );
}

async function Flags() {
  await connection();
  const { admin } = await requirePage("flags");
  const t = await getTranslations("admin.flags");
  const { data } = await admin
    .from("feature_flags")
    .select("key, enabled, rollout_percent, description")
    .order("key");
  const flags = data ?? [];
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="max-w-prose text-sm text-ink-muted">{t("note")}</p>
      <section aria-labelledby="new-flag" className="grid gap-3">
        <h2 id="new-flag" className="text-xl">
          {t("add")}
        </h2>
        <NewFlagForm />
      </section>
      {flags.length === 0 ? <p className="text-ink-muted">{t("empty")}</p> : null}
      <div className="grid gap-3">
        {flags.map((f) => (
          <FlagRowForm key={f.key} flag={f} />
        ))}
      </div>
    </div>
  );
}
