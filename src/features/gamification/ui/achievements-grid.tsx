import { useTranslations } from "next-intl";

import { cx } from "@/lib/cx";

import { ACHIEVEMENTS } from "../achievements";

/** Every achievement, earned ones first (Phase 14). Earned/locked is said in words. */
export function AchievementsGrid({ owned }: { owned: ReadonlySet<string> }) {
  const t = useTranslations("gamification");
  const items = [...ACHIEVEMENTS].sort((a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id)));
  return (
    <div className="grid gap-3">
      <p className="font-sans text-sm text-ink-muted">
        {t("profile.achievementsCount", {
          n: ACHIEVEMENTS.filter((a) => owned.has(a.id)).length,
          total: ACHIEVEMENTS.length,
        })}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-achievements="">
        {items.map((a) => {
          const has = owned.has(a.id);
          return (
            <li
              key={a.id}
              data-achievement={a.id}
              data-earned={has ? "" : undefined}
              className={cx(
                "rounded-md border px-4 py-3",
                has ? "border-accent bg-surface" : "border-rule text-ink-muted",
              )}
            >
              <p className={cx("font-sans text-sm font-semibold", has && "text-ink")}>
                {t(`achievements.${a.id}.name` as "achievements.kelly.name")}
              </p>
              <p className="font-sans text-xs">
                {t(`achievements.${a.id}.description` as "achievements.kelly.description")}
              </p>
              <p className="mt-1 font-sans text-2xs tracking-wide uppercase">
                {has ? t("profile.earned") : t("profile.locked")}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
