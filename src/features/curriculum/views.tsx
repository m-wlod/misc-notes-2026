import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";

import { formatDuration, type ModuleView, type TrackView } from "./index";

/** Path / Map / Textbook switch shown on the curriculum views. */
export async function CurriculumTabs({ current }: { current: "path" | "map" | "textbook" }) {
  const t = await getTranslations("curriculum.views");
  const tabs = [
    ["path", "/learn"],
    ["map", "/map"],
    ["textbook", "/textbook"],
  ] as const;
  return (
    <nav aria-label={t("label")} className="mb-8">
      <ul className="inline-flex rounded border border-rule-strong font-sans text-sm">
        {tabs.map(([key, href]) => (
          <li key={key}>
            <Link
              href={href}
              aria-current={current === key ? "page" : undefined}
              className={cx(
                "block px-3 py-1.5",
                current === key ? "bg-ink text-bg" : "text-ink-muted hover:text-ink",
              )}
            >
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** "Poziomy 1–2 · 6 lekcji · 1 godz. 9 min" for a track or a module. */
export async function UnitMeta({ unit }: { unit: TrackView | ModuleView }) {
  const t = await getTranslations("curriculum");
  const lessons = "modules" in unit ? unit.modules.flatMap((m) => m.lessons) : unit.lessons;
  const levels = lessons.map((l) => l.level);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  return (
    <p className="flex flex-wrap gap-x-3 font-sans text-sm text-ink-muted">
      <span>{min === max ? t("level", { level: min }) : t("levels", { min, max })}</span>
      <span>{t("lessonCount", { count: lessons.length })}</span>
      <span className="num">{t("duration", formatDuration(unit.minutes))}</span>
    </p>
  );
}
