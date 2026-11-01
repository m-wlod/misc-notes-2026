"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";

import { nodeState, type NodeState } from "./node-state";
import { useLocalProgress } from "./use-local-progress";

export type MapNode = {
  id: string;
  number: string;
  title: string;
  level: number;
  track: string;
  prerequisites: string[];
  url: string;
  x: number;
  y: number;
};

type Props = {
  nodes: readonly MapNode[];
  edges: readonly { from: string; to: string }[];
  width: number;
  height: number;
  tracks: readonly { id: string; name: string }[];
};

type View = { k: number; x: number; y: number };

const R = 17;
const MIN_K = 0.25;
const MAX_K = 2.5;
const LEVELS = [1, 2, 3, 4, 5] as const;

/** Node fill and outline by state (same meaning as the path's circles). */
const nodeClass: Record<NodeState | "unknown", string> = {
  unknown: "fill-bg stroke-rule",
  locked: "fill-bg stroke-rule-strong",
  available: "fill-bg stroke-accent",
  in_progress: "fill-sunken stroke-accent",
  done: "fill-ink stroke-ink",
  mastered: "fill-accent stroke-accent",
};

/**
 * Wrap a title onto at most 3 short lines. The whole title stays visible, so the link's
 * accessible name can start with exactly what is on screen (WCAG 2.5.3 label in name).
 */
export function wrapTitle(title: string, max = 22): string[] {
  const lines: string[] = [];
  for (const word of title.split(" ")) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= max)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/**
 * The prerequisite graph as SVG (layout computed on the server). Pan by dragging or with
 * the arrow keys, zoom with the wheel, the buttons or +/−. Nodes are links in curriculum
 * order; focusing one brings it into view. The textbook view is the text alternative.
 */
export function CurriculumMap({ nodes, edges, width, height, tracks }: Props) {
  const t = useTranslations("curriculum");
  const statuses = useLocalProgress();
  const helpId = useId();
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [track, setTrack] = useState("all");
  const [levels, setLevels] = useState<ReadonlySet<number>>(new Set(LEVELS));

  const size = () => ({
    w: box.current?.clientWidth ?? width,
    h: box.current?.clientHeight ?? height,
  });

  const fit = useCallback(() => {
    const { w, h } = {
      w: box.current?.clientWidth ?? width,
      h: box.current?.clientHeight ?? height,
    };
    const k = Math.max(MIN_K, Math.min(1, w / width, h / height));
    setView({ k, x: (w - width * k) / 2, y: Math.max(0, (h - height * k) / 2) });
  }, [width, height]);

  useEffect(() => {
    fit();
  }, [fit]);

  // Zoom around a point (container coordinates).
  const zoom = useCallback((factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      if (!v) return v;
      const w = box.current?.clientWidth ?? 0;
      const h = box.current?.clientHeight ?? 0;
      const px = cx ?? w / 2;
      const py = cy ?? h / 2;
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
    });
  }, []);

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [zoom]);

  const pan = (dx: number, dy: number) => {
    setView((v) => (v ? { ...v, x: v.x + dx, y: v.y + dy } : v));
  };

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = 60;
    const actions: Record<string, () => void> = {
      "+": () => {
        zoom(1.25);
      },
      "=": () => {
        zoom(1.25);
      },
      "-": () => {
        zoom(0.8);
      },
      "0": fit,
      ArrowLeft: () => {
        pan(step, 0);
      },
      ArrowRight: () => {
        pan(-step, 0);
      },
      ArrowUp: () => {
        pan(0, step);
      },
      ArrowDown: () => {
        pan(0, -step);
      },
    };
    const action = actions[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  }

  /** Keep a focused node in view (keyboard users tab through the graph). */
  function reveal(node: MapNode) {
    setView((v) => {
      if (!v) return v;
      const { w, h } = size();
      const sx = v.x + node.x * v.k;
      const sy = v.y + node.y * v.k;
      const margin = 60;
      if (sx > margin && sx < w - margin && sy > margin && sy < h - margin) return v;
      return { ...v, x: w / 2 - node.x * v.k, y: h / 2 - node.y * v.k };
    });
  }

  const at = new Map(nodes.map((n) => [n.id, n]));
  const matches = (n: MapNode) => (track === "all" || n.track === track) && levels.has(n.level);
  const matching = nodes.filter(matches).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 font-sans text-sm">
        <label className="grid gap-1">
          <span className="text-xs text-ink-muted">{t("map.track")}</span>
          <select
            value={track}
            onChange={(e) => {
              setTrack(e.target.value);
            }}
            className="rounded border border-rule-strong bg-surface px-2 py-1.5 text-ink"
          >
            <option value="all">{t("map.allTracks")}</option>
            {tracks.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="grid gap-1">
          <legend className="mb-1 text-xs text-ink-muted">{t("map.levels")}</legend>
          <div className="flex gap-1">
            {LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={levels.has(level)}
                aria-label={t("map.level", { level })}
                onClick={() => {
                  setLevels((prev) => {
                    const next = new Set(prev);
                    if (next.has(level)) next.delete(level);
                    else next.add(level);
                    return next;
                  });
                }}
                className="size-8 rounded border border-rule-strong num text-ink-muted aria-pressed:bg-ink aria-pressed:text-bg"
              >
                {level}
              </button>
            ))}
          </div>
        </fieldset>
        <p role="status" className="text-xs text-ink-muted">
          {t("map.showing", { count: matching, total: nodes.length })}
        </p>
        <div className="ml-auto flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              zoom(1.25);
            }}
          >
            {t("map.zoomIn")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              zoom(0.8);
            }}
          >
            {t("map.zoomOut")}
          </Button>
          <Button variant="secondary" size="sm" onClick={fit}>
            {t("map.reset")}
          </Button>
        </div>
      </div>

      <p id={helpId} className="font-sans text-xs text-ink-muted">
        {t("map.help")}
      </p>

      {/* A focusable pan/zoom region (like a scroll area): keys and drag move the view, and
          the nodes inside stay ordinary links. role="application" would put screen readers
          in a mode that hides those links' normal navigation, so group is kept. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={box}
        role="group"
        tabIndex={0}
        aria-label={t("map.canvas", { count: nodes.length })}
        aria-describedby={helpId}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          if ((e.target as Element).closest("a")) return;
          if (!view) return;
          drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setView((v) => (v ? { ...v, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py } : v));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        className="relative h-[70vh] min-h-96 cursor-grab touch-none overflow-hidden rounded-md border border-rule-strong bg-bg active:cursor-grabbing"
      >
        <svg width="100%" height="100%" className="block select-none" data-testid="curriculum-map">
          <defs>
            <marker
              id="map-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-rule-strong" />
            </marker>
          </defs>
          <g
            transform={
              view
                ? `translate(${String(view.x)} ${String(view.y)}) scale(${String(view.k)})`
                : undefined
            }
            className={view ? undefined : "opacity-0"}
          >
            {edges.map((e) => {
              const a = at.get(e.from);
              const b = at.get(e.to);
              if (!a || !b) return null;
              const lit = matches(a) && matches(b);
              const midY = (a.y + b.y) / 2;
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={`M ${String(a.x)} ${String(a.y + R)} C ${String(a.x)} ${String(midY)}, ${String(b.x)} ${String(midY)}, ${String(b.x)} ${String(b.y - R - 2)}`}
                  markerEnd="url(#map-arrow)"
                  className={cx("fill-none stroke-rule-strong", lit ? "opacity-70" : "opacity-10")}
                  strokeWidth={1.2}
                />
              );
            })}
            {nodes.map((n) => {
              const state = statuses ? nodeState(n.id, n.prerequisites, statuses) : null;
              const style = nodeClass[state ?? "unknown"];
              const lit = matches(n);
              return (
                <a
                  key={n.id}
                  href={n.url}
                  data-lesson={n.id}
                  data-state={state ?? "unknown"}
                  data-dimmed={lit ? undefined : "true"}
                  aria-label={t("map.nodeLabel", {
                    number: n.number,
                    title: n.title,
                    state: state ? t(`state.${state}`) : "",
                  })}
                  onFocus={() => {
                    reveal(n);
                  }}
                  className={cx("group outline-none", lit ? undefined : "opacity-15")}
                >
                  <title>{`${n.number} ${n.title}`}</title>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={R}
                    strokeWidth={2}
                    className={cx(style, "group-focus-visible:stroke-focus")}
                  />
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={R + 5}
                    className="fill-none stroke-focus opacity-0 group-focus-visible:opacity-100"
                    strokeWidth={2}
                  />

                  <text
                    x={n.x}
                    y={n.y + R + 15}
                    textAnchor="middle"
                    className="fill-ink font-sans text-2xs group-hover:underline"
                  >
                    {wrapTitle(n.title).map((line, i, lines) => (
                      // Keep the space between lines, or the visible text reads
                      // "rynkoweto" and no longer matches the link's name (WCAG 2.5.3).
                      <tspan key={`${String(i)}-${line}`} x={n.x} dy={i === 0 ? 0 : 12}>
                        {i < lines.length - 1 ? `${line} ` : line}
                      </tspan>
                    ))}
                  </text>
                </a>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
