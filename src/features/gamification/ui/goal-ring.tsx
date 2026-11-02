import { goalShare } from "../today";

/**
 * Today's goal as a ring (Phase 14): a thin accent arc on a grid-coloured track, the
 * numbers in the middle. One value, so no legend; the label says it in words.
 */
export function GoalRing({ xp, goal, label }: { xp: number; goal: number; label: string }) {
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = goalShare(xp, goal);
  return (
    <svg
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      data-goal-ring={Math.round(share * 100)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className="stroke-grid"
        strokeWidth={stroke}
      />
      {share > 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-accent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${String(c * share)} ${String(c)}`}
          transform={`rotate(-90 ${String(size / 2)} ${String(size / 2)})`}
        />
      ) : null}
      <text
        x={size / 2}
        y={size / 2 + 5}
        textAnchor="middle"
        className="fill-ink font-mono text-sm"
      >
        {Math.min(xp, 9999)}/{goal}
      </text>
    </svg>
  );
}
