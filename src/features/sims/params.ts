import type { ParamSpec, Params, ParamValue } from "./types";

/**
 * Simulation state in the URL (Phase 12): `?seed=…&t=…&<param>=…`. Parsing is strict and
 * clamps every value into its spec, so a hand-edited or stale link still opens a valid
 * run, and a shared link reproduces the exact one.
 */
export const MAX_SEED = 0xffff_ffff;
/** The run shown when a link has no seed: fixed, so every visitor sees the same one. */
export const DEFAULT_SEED = 20_261_102;

export function defaults(specs: Readonly<Record<string, ParamSpec>>): Params {
  return Object.fromEntries(Object.entries(specs).map(([k, s]) => [k, s.default]));
}

const snap = (v: number, min: number, step: number) => {
  const n = Math.round((v - min) / step);
  return Math.round((min + n * step) * 1e9) / 1e9;
};

/** A raw value (string from the URL or a slider) as a valid value of the spec. */
export function clampParam(spec: ParamSpec, raw: unknown): ParamValue {
  switch (spec.kind) {
    case "number":
    case "int": {
      const text = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
      const v = typeof raw === "number" ? raw : Number(text.replace(",", "."));
      if (!Number.isFinite(v) || text.trim() === "") return spec.default;
      const step = spec.kind === "int" ? Math.max(1, spec.step ?? 1) : spec.step;
      return Math.min(spec.max, Math.max(spec.min, snap(v, spec.min, step)));
    }
    case "choice":
      return typeof raw === "string" && spec.options.includes(raw) ? raw : spec.default;
    case "toggle":
      return raw === true || raw === "1"
        ? true
        : raw === false || raw === "0"
          ? false
          : spec.default;
  }
}

export type SimState = { params: Params; seed: number; t: number | null };

export function parseState(
  specs: Readonly<Record<string, ParamSpec>>,
  search: URLSearchParams,
  fallbackSeed: number,
): SimState {
  const params = defaults(specs);
  for (const [k, spec] of Object.entries(specs)) {
    if (search.has(k)) params[k] = clampParam(spec, search.get(k));
  }
  const seedRaw = Number(search.get("seed"));
  const seed =
    search.has("seed") && Number.isInteger(seedRaw) && seedRaw >= 0 && seedRaw <= MAX_SEED
      ? seedRaw
      : fallbackSeed;
  const tRaw = Number(search.get("t"));
  const t = search.has("t") && Number.isInteger(tRaw) && tRaw >= 0 ? tRaw : null;
  return { params, seed, t };
}

export function stateQuery(
  specs: Readonly<Record<string, ParamSpec>>,
  { params, seed, t }: SimState,
): string {
  const q = new URLSearchParams();
  q.set("seed", String(seed));
  for (const [k, spec] of Object.entries(specs)) {
    const v = params[k] ?? spec.default;
    q.set(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  if (t !== null) q.set("t", String(t));
  return q.toString();
}

/** Coerce typed accessors (params are validated, so these never fail at runtime). */
export const num = (p: Params, k: string) => Number(p[k]);
export const str = (p: Params, k: string) => String(p[k]);
export const bool = (p: Params, k: string) => p[k] === true;
