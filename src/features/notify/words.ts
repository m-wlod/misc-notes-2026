import "server-only";

import { getTranslations } from "next-intl/server";

import type { EmailData, EmailWords } from "./email";

/** The words of a notification in the learner's language (messages: notify.email). */
export async function emailWords(data: EmailData, locale: "pl" | "en"): Promise<EmailWords> {
  const t = await getTranslations({ locale, namespace: "notify.email" });
  const tiers = await getTranslations({ locale, namespace: "gamification.tiers" });
  const common = { footer: t("footer"), unsubscribe: t("unsubscribe") };
  if (data.kind === "streak") {
    return {
      ...common,
      subject: t("streak.subject", { days: data.days }),
      lines: [t("streak.line1", { days: data.days }), t("streak.line2")],
      cta: t("streak.cta"),
    };
  }
  if (data.kind === "weekly") {
    return {
      ...common,
      subject: t("weekly.subject", { xp: data.xp }),
      lines: [t("weekly.line1", data), t("weekly.line2")],
      cta: t("weekly.cta"),
    };
  }
  const tier = tiers(data.tier as "bernoulli");
  return {
    ...common,
    subject: t("league.subject", { tier, rank: data.rank, size: data.size }),
    lines: [
      t("league.line1", { tier, rank: data.rank, size: data.size }),
      t(`league.${data.outcome}`),
    ],
    cta: t("league.cta"),
  };
}
