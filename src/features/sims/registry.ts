import { bayes } from "./defs/bayes";
import { coinWalk } from "./defs/coin-walk";
import { evHeatmap } from "./defs/ev-heatmap";
import { fourier } from "./defs/fourier";
import { gbm } from "./defs/gbm";
import { kelly } from "./defs/kelly";
import { llnClt } from "./defs/lln-clt";
import { martingale } from "./defs/martingale";
import { monteCarlo } from "./defs/monte-carlo";
import { optionBuilder } from "./defs/options";
import { overfitting } from "./defs/overfitting";
import { volDrag } from "./defs/vol-drag";
import type { SimDef } from "./types";

/**
 * Every simulation, in the order the Lab lists them (Phase 12). Pure definitions: the
 * worker imports this too, so nothing here touches the DOM at import time.
 */
export const SIMS: readonly SimDef[] = [
  coinWalk,
  llnClt,
  gbm,
  monteCarlo,
  martingale,
  kelly,
  volDrag,
  evHeatmap,
  overfitting,
  fourier,
  bayes,
  optionBuilder,
];

export const SIM_IDS = SIMS.map((s) => s.id);
export const simById = (id: string) => SIMS.find((s) => s.id === id);
export const simBySlug = (slug: string) =>
  SIMS.find((s) => s.slug.pl === slug || s.slug.en === slug);
