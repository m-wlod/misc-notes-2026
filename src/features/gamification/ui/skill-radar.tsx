import { useTranslations } from "next-intl";

/**
 * Skill rating per topic (Phase 14). A radar needs at least three axes; with fewer topics
 * (or as the accessible version) the same numbers are listed as text, which is always
 * present. One series, so no legend: the heading names it.
 */
const SIZE = 280;
const C = SIZE / 2;
const R = 100;
const MIN = 600;
const MAX = 2000;

const radius = (rating: number) => ((Math.min(MAX, Math.max(MIN, rating)) - MIN) / (MAX - MIN)) * R;

export function SkillRadar({ ratings }: { ratings: { topic: string; rating: number }[] }) {
  const t = useTranslations("gamification.profile");
  if (ratings.length === 0) {
    return <p className="font-sans text-sm text-ink-muted">{t("skillsEmpty")}</p>;
  }
  const sorted = [...ratings].sort((a, b) => (a.topic < b.topic ? -1 : 1));
  const n = sorted.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, r: number) =>
    [C + Math.cos(angle(i)) * r, C + Math.sin(angle(i)) * r] as const;
  const shape =
    sorted
      .map((s, i) => point(i, radius(s.rating)))
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join("") + "Z";

  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
      {n >= 3 ? (
        <svg
          viewBox={`0 0 ${String(SIZE)} ${String(SIZE)}`}
          className="h-auto w-full max-w-[280px]"
          role="img"
          aria-label={t("skillsLabel")}
          data-skill-radar=""
        >
          {[0.25, 0.5, 0.75, 1].map((k) => (
            <polygon
              key={k}
              points={sorted.map((_, i) => point(i, R * k).join(",")).join(" ")}
              fill="none"
              className="stroke-grid"
            />
          ))}
          {sorted.map((s, i) => {
            const [x, y] = point(i, R);
            const [lx, ly] = point(i, R + 18);
            return (
              <g key={s.topic}>
                <line x1={C} y1={C} x2={x} y2={y} className="stroke-grid" />
                <text
                  x={lx}
                  y={ly + 4}
                  textAnchor={Math.abs(lx - C) < 8 ? "middle" : lx > C ? "start" : "end"}
                  className="fill-ink-muted font-sans text-2xs"
                >
                  {s.topic}
                </text>
              </g>
            );
          })}
          <path
            d={shape}
            className="stroke-accent"
            strokeWidth={2}
            strokeLinejoin="round"
            style={{ fill: "color-mix(in srgb, var(--accent) 18%, transparent)" }}
          />
        </svg>
      ) : null}
      <div>
        <ul className="grid gap-1 font-sans text-sm" data-skill-list="">
          {sorted.map((s) => (
            <li key={s.topic} className="flex justify-between gap-6 border-b border-rule py-1">
              <span>{s.topic}</span>
              <span className="num">{Math.round(s.rating)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-sans text-xs text-ink-muted">{t("skillsNote")}</p>
      </div>
    </div>
  );
}
