"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { claimAchievement } from "@/features/gamification/actions";
import { cx } from "@/lib/cx";

import { makePlot, readPalette, ticks } from "./axes";
import { downloadCanvas, renderFrame } from "./export";
import { clampParam, MAX_SEED, stateQuery, type SimState } from "./params";
import { simById } from "./registry";
import { computeSim } from "./run-compute";
import type { AxisFormat, ParamSpec, Params, SimData } from "./types";

const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;

/**
 * The simulation player (Phase 12): computes the run (in a worker when heavy), then
 * reveals it frame by frame. Canvas for the data, SVG for axes; play / pause / step /
 * reset, speed, parameters with exact inputs, the state in the URL, PNG export and a
 * 9:16 recording mode. Keyboard: Space plays or pauses, → steps, R resets.
 */
export function SimPlayer({
  id,
  initial,
  recording = false,
  syncUrl = true,
  compact = false,
}: {
  id: string;
  initial: SimState;
  recording?: boolean;
  /** Keep the page URL in sync (the /lab page does; an embed in a lesson doesn't). */
  syncUrl?: boolean;
  /** Embedded in a lesson: fewer controls. */
  compact?: boolean;
}) {
  const def = simById(id);
  const t = useTranslations("sims");
  const locale = useLocale();
  const format = useFormatter();
  const uid = useId();

  const [params, setParams] = useState<Params>(initial.params);
  // A run played to the end can earn a browser-claimed achievement (Phase 14): the
  // martingale with 1,000+ players is "Ruina gracza". Signed out the claim does nothing.
  const onRunEnd = useRef<() => void>(() => undefined);
  useEffect(() => {
    onRunEnd.current = () => {
      if (id === "martingale" && Number(params.players) >= 1000) {
        void claimAchievement({ id: "ruina-gracza" }).catch(() => undefined);
      }
    };
  });
  const [seed, setSeed] = useState(initial.seed);
  const [data, setData] = useState<SimData | null>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Set by the first play, step, reset or parameter change: from then on the result is
  // announced to screen readers each time playback stops (never frame by frame).
  const [interacted, setInteracted] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [copied, setCopied] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const onKey = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const base = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(0);
  const frameRef = useRef(0);
  const wantFrame = useRef<number | null>(initial.t);

  // Compute the run whenever the inputs change (in the worker for heavy simulations).
  useEffect(() => {
    if (!def) return;
    let live = true;
    void computeSim(def, params, seed).then((d) => {
      if (!live) return;
      const start = def.static ? d.T : Math.min(wantFrame.current ?? 0, d.T);
      wantFrame.current = null;
      frameRef.current = start;
      drawn.current = 0;
      setFrame(start);
      setData(d);
    });
    return () => {
      live = false;
    };
  }, [def, params, seed]);

  // Canvas size follows the container (and the device pixel ratio).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0);
      const h = Math.round(recording ? w * 1.0 : Math.max(240, Math.min(w * 0.6, 520)));
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [recording]);

  const view = useMemo(() => (def && data ? def.view(data, params) : null), [def, data, params]);
  const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);

  const fmt = useCallback(
    (v: number, f: AxisFormat | undefined) =>
      f === "log10"
        ? format.number(10 ** v, { maximumSignificantDigits: 2 })
        : f === "int"
          ? format.number(v, { maximumFractionDigits: 0 })
          : f === "pct"
            ? format.number(v, { style: "percent", maximumFractionDigits: 0 })
            : format.number(v, { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 0 }),
    [format],
  );

  const label = useCallback(
    (key: string) => (def ? t(`${def.id}.labels.${key}` as "coin-walk.title") : key),
    [def, t],
  );

  /** Draws the persistent layer up to `to` (incrementally) and the overlay at `to`. */
  const paint = useCallback(
    (to: number, full: boolean) => {
      if (!def || !data || !view || !size.w) return;
      const c = readPalette();
      const plot = makePlot(view, size.w * dpr, size.h * dpr, dpr);
      const b = base.current?.getContext("2d");
      const o = over.current?.getContext("2d");
      if (!b || !o) return;
      const clip = (ctx: CanvasRenderingContext2D) => {
        ctx.beginPath();
        ctx.rect(plot.left, plot.top, plot.width, plot.height);
        ctx.clip();
      };
      if (full || to < drawn.current) {
        b.clearRect(0, 0, b.canvas.width, b.canvas.height);
        drawn.current = 0;
      }
      if (to > drawn.current || drawn.current === 0) {
        b.save();
        clip(b);
        def.draw(b, data, drawn.current, to, plot, c, params);
        b.restore();
        drawn.current = Math.max(drawn.current, to);
      }
      o.clearRect(0, 0, o.canvas.width, o.canvas.height);
      o.save();
      clip(o);
      def.overlay?.(o, data, to, plot, c, params, label);
      o.restore();
    },
    [def, data, view, size, dpr, params, label],
  );

  // Full repaint when the data, size or theme changes.
  useEffect(() => {
    paint(frameRef.current, true);
    const mo = new MutationObserver(() => {
      paint(frameRef.current, true);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => {
      mo.disconnect();
    };
  }, [paint]);

  // The animation loop.
  useEffect(() => {
    if (!playing || !def || !data) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    let acc = frameRef.current;
    const perSecond = data.T / (def.seconds ?? 8);
    const tick = (now: number) => {
      acc = Math.min(data.T, acc + ((now - last) / 1000) * perSecond * speed);
      last = now;
      const next = Math.floor(acc);
      if (next !== frameRef.current) {
        frameRef.current = next;
        paint(next, false);
        // The canvas updates every frame; the React UI (summary, counter) ten times a
        // second, so re-rendering never costs animation frames.
        if (now - lastUi >= 100) {
          lastUi = now;
          setFrame(next);
        }
      }
      if (next >= data.T) {
        setFrame(next);
        setPlaying(false);
        onRunEnd.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [playing, def, data, speed, paint]);

  const url = useCallback(
    (state: SimState, record = recording) => {
      if (!def) return "";
      const q = stateQuery(def.params, state);
      // Query-only: resolves against the current page, and is safe to build while rendering.
      return `?${q}${record ? "&nagranie=1" : ""}`;
    },
    [def, recording],
  );

  const goTo = useCallback(
    (to: number) => {
      if (!data) return;
      const v = Math.max(0, Math.min(data.T, to));
      frameRef.current = v;
      paint(v, v < drawn.current);
      setFrame(v);
      setInteracted(true);
    },
    [data, paint],
  );

  /** Play, pause (showing the exact frame), or replay from the start at the end. */
  const togglePlay = () => {
    setInteracted(true);
    if (playing) {
      setPlaying(false);
      setFrame(frameRef.current);
      return;
    }
    if (data && frameRef.current >= data.T) goTo(0);
    setPlaying(true);
  };

  const syncLink = (next: { params?: Params; seed?: number; t?: number | null }) => {
    if (!syncUrl || !def) return;
    window.history.replaceState(
      null,
      "",
      url({ params: next.params ?? params, seed: next.seed ?? seed, t: next.t ?? null }),
    );
  };

  const T = data?.T ?? 0;
  const stepSize = Math.max(1, Math.ceil(T / 100));

  // Keyboard: Space plays or pauses, → steps, R resets (not while typing or on a button).
  useEffect(() => {
    onKey.current = (e: KeyboardEvent) => {
      const el = e.target;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLButtonElement ||
        el instanceof HTMLAnchorElement
      )
        return;
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        goTo(frameRef.current + stepSize);
      } else if (e.key.toLowerCase() === "r") {
        setPlaying(false);
        goTo(0);
      }
    };
  });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      onKey.current(e);
    };
    el.addEventListener("keydown", handler);
    return () => {
      el.removeEventListener("keydown", handler);
    };
  }, []);

  if (!def) return null;
  // Numbers in the description follow the locale (Polish decimal comma).
  const summaryValues = data
    ? Object.fromEntries(
        Object.entries(def.summary(data, frame, params)).map(([k, v]) => [
          k,
          typeof v === "number" ? format.number(v, { maximumFractionDigits: 4 }) : v,
        ]),
      )
    : null;
  const summary = summaryValues
    ? t(`${def.id}.summary` as "coin-walk.summary", summaryValues as never)
    : t("computing");
  const cssPlot = view ? makePlot(view, size.w, size.h, 1) : null;
  const axis = view && cssPlot ? ticks(view, cssPlot, fmt) : null;
  const plotRight = cssPlot ? cssPlot.left + cssPlot.width : size.w - 14;

  const setParam = (name: string, spec: ParamSpec, raw: unknown) => {
    const next = { ...params, [name]: clampParam(spec, raw) };
    setInteracted(true);
    setPlaying(false);
    setParams(next);
    syncLink({ params: next });
  };

  return (
    <div
      ref={root}
      className={cx("grid gap-4", recording && "mx-auto max-w-[540px]")}
      role="region"
      aria-label={t(`${def.id}.title` as "coin-walk.title")}
      // Focusable so the keyboard shortcuts work without first focusing a control.
      tabIndex={0}
    >
      <div
        ref={box}
        role="img"
        aria-label={summary}
        className="relative w-full"
        style={{ height: size.h || undefined }}
      >
        <canvas
          ref={base}
          width={size.w * dpr}
          height={size.h * dpr}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        <canvas
          ref={over}
          width={size.w * dpr}
          height={size.h * dpr}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        {axis && view ? (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <g className="fill-ink-muted font-mono text-2xs">
              {axis.y.map((y) => (
                <text key={`y${String(y.v)}`} x={44} y={y.at + 4} textAnchor="end">
                  {y.label}
                </text>
              ))}
              {axis.x.map((x) => (
                <text key={`x${String(x.v)}`} x={x.at} y={size.h - 24} textAnchor="middle">
                  {x.label}
                </text>
              ))}
            </g>
            <g className="fill-ink-muted font-sans text-xs">
              <text x={(52 + plotRight) / 2} y={size.h - 6} textAnchor="middle">
                {t(`axes.${view.xLabel}` as "axes.days")}
              </text>
              <text
                x={12}
                y={size.h / 2}
                textAnchor="middle"
                transform={`rotate(-90 12 ${String(size.h / 2)})`}
              >
                {t(`axes.${view.yLabel}` as "axes.days")}
              </text>
            </g>
            {axis.y.map((y) => (
              <line
                key={`g${String(y.v)}`}
                x1={52}
                x2={plotRight}
                y1={y.at}
                y2={y.at}
                className="stroke-grid"
              />
            ))}
          </svg>
        ) : null}
      </div>

      <p className="num font-sans text-sm text-ink" aria-live="off">
        {summary}
      </p>
      <p className="sr-only" aria-live="polite" data-sim-announce>
        {interacted && !playing && data ? summary : ""}
      </p>

      {compact ? null : (
        <details className="font-sans text-sm text-ink" data-sim-data>
          <summary className="cursor-pointer text-accent-text">{t("data.show")}</summary>
          <table className="mt-2 num">
            <caption className="text-left text-ink-muted">
              {t("seed", { seed })} · {t("data.frame", { frame, total: data?.T ?? 0 })}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pr-6 text-left font-medium">
                  {t("data.parameter")}
                </th>
                <th scope="col" className="text-left font-medium">
                  {t("data.value")}
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(def.params).map(([name, spec]) => {
                const v = params[name] ?? spec.default;
                return (
                  <tr key={name}>
                    <th scope="row" className="pr-6 text-left font-normal">
                      {t(`${def.id}.params.${name}` as "coin-walk.params.paths")}
                    </th>
                    <td>
                      {typeof v === "number"
                        ? format.number(v, { maximumFractionDigits: 4 })
                        : typeof v === "boolean"
                          ? t(v ? "data.on" : "data.off")
                          : t.has(`${def.id}.options.${v}` as "options.gbm")
                            ? t(`${def.id}.options.${v}` as "options.gbm")
                            : t.has(`options.${v}` as "options.gbm")
                              ? t(`options.${v}` as "options.gbm")
                              : v}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}

      {def.static ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={!data} onClick={togglePlay}>
            {playing ? t("pause") : frame >= T && T > 0 ? t("replay") : t("play")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!data || frame >= T}
            onClick={() => {
              setPlaying(false);
              goTo(frame + stepSize);
            }}
          >
            {t("step")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!data}
            onClick={() => {
              setPlaying(false);
              goTo(0);
            }}
          >
            {t("reset")}
          </Button>
          <label className="flex items-center gap-2 font-sans text-sm text-ink">
            {t("speed")}
            <select
              value={speed}
              onChange={(e) => {
                setSpeed(Number(e.target.value));
              }}
              className="rounded border border-rule-strong bg-surface px-2 py-1"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {format.number(s)}×
                </option>
              ))}
            </select>
          </label>
          <span className="num font-sans text-xs text-ink-muted">
            {t("frame", { frame, total: T })}
          </span>
        </div>
      )}

      {compact ? null : (
        <fieldset className="grid gap-3 rounded-md border border-rule px-4 py-3 sm:grid-cols-2">
          <legend className="px-1 font-sans text-sm text-ink">{t("parameters")}</legend>
          {Object.entries(def.params).map(([name, spec]) => (
            <ParamControl
              key={name}
              id={`${uid}-${name}`}
              label={t(`${def.id}.params.${name}` as "coin-walk.params.paths")}
              option={(o) =>
                t.has(`${def.id}.options.${o}` as "options.gbm")
                  ? t(`${def.id}.options.${o}` as "options.gbm")
                  : t(`options.${o}` as "options.gbm")
              }
              spec={spec}
              value={params[name] ?? spec.default}
              onChange={(raw) => {
                setParam(name, spec, raw);
              }}
            />
          ))}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <span className="num font-sans text-xs text-ink-muted">{t("seed", { seed })}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const a = new Uint32Array(1);
                crypto.getRandomValues(a);
                const s = (a[0] ?? 1) % MAX_SEED;
                setPlaying(false);
                setSeed(s);
                syncLink({ seed: s });
              }}
            >
              {t("reroll")}
            </Button>
          </div>
        </fieldset>
      )}

      {compact ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              const link = `${window.location.origin}${window.location.pathname}${url({ params, seed, t: frame })}`;
              void navigator.clipboard.writeText(link).then(() => {
                setCopied(true);
              });
              window.history.replaceState(null, "", url({ params, seed, t: frame }));
            }}
          >
            {copied ? t("copied") : t("share")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!data}
            onClick={() => {
              if (!data || !view) return;
              const canvas = renderFrame(
                def,
                data,
                params,
                frame,
                readPalette(),
                fmt,
                label,
                {
                  title: t(`${def.id}.title` as "coin-walk.title"),
                  xLabel: t(`axes.${view.xLabel}` as "axes.days"),
                  yLabel: t(`axes.${view.yLabel}` as "axes.days"),
                  summary,
                  details: `${t("seed", { seed })} · ${Object.entries(params)
                    .map(([k, v]) => `${k} ${String(v)}`)
                    .join(" · ")}`,
                  source: t("source"),
                },
                { recording },
              );
              downloadCanvas(canvas, `${def.id}-${String(seed)}${recording ? "-9x16" : ""}.png`);
            }}
          >
            {recording ? t("exportRecording") : t("exportPng")}
          </Button>
          <a
            href={url({ params, seed, t: frame }, !recording)}
            hrefLang={locale}
            className="font-sans text-sm"
          >
            {recording ? t("leaveRecording") : t("recording")}
          </a>
        </div>
      )}
    </div>
  );
}

function ParamControl({
  id,
  label,
  spec,
  value,
  option,
  onChange,
}: {
  id: string;
  label: string;
  spec: ParamSpec;
  value: unknown;
  option: (o: string) => string;
  onChange: (raw: unknown) => void;
}) {
  const format = useFormatter();
  const display = (v: number) => format.number(v, { maximumFractionDigits: 6, useGrouping: false });
  if (spec.kind === "choice") {
    return (
      <div className="grid gap-1">
        <label htmlFor={id} className="font-sans text-sm text-ink">
          {label}
        </label>
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="rounded border border-rule-strong bg-surface px-2 py-1.5 text-sm"
        >
          {spec.options.map((o) => (
            <option key={o} value={o}>
              {option(o)}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (spec.kind === "toggle") {
    return (
      <label className="flex items-center gap-2 font-sans text-sm text-ink">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => {
            onChange(e.target.checked);
          }}
          className="size-4 accent-(--accent)"
        />
        {label}
      </label>
    );
  }
  const step = spec.kind === "int" ? (spec.step ?? 1) : spec.step;
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="font-sans text-sm text-ink">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="range"
          min={spec.min}
          max={spec.max}
          step={step}
          value={Number(value)}
          onChange={(e) => {
            onChange(Number(e.target.value));
          }}
          className="min-w-0 flex-1 accent-(--accent)"
        />
        {/* Text, not type=number: Polish users type a decimal comma (0,25). */}
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={label}
          defaultValue={display(Number(value))}
          key={String(value)}
          onBlur={(e) => {
            onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onChange(e.currentTarget.value);
          }}
          className="w-24 rounded border border-rule-strong bg-surface px-2 py-1 num text-sm"
        />
      </div>
    </div>
  );
}
