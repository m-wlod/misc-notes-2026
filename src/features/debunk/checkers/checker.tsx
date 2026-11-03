"use client";

import { EvChecker, type EvPreset } from "./ev-checker";
import type { CheckerId } from "./ids";
import { IndicatorChecker } from "./indicator-checker";
import type { IndicatorKind } from "./indicators";
import { LuckChecker, type LuckPreset } from "./luck-checker";
import { MlmChecker, type MlmPreset } from "./mlm-checker";

/** A claim checker by id (Phase 16); entries embed one with `<Checker id="…" />`. */
export function Checker({
  id,
  preset,
}: {
  id: CheckerId;
  preset?: Partial<EvPreset & LuckPreset & MlmPreset & { kind: IndicatorKind; seed: number }>;
}) {
  if (id === "ev") return <EvChecker preset={preset} />;
  if (id === "luck") return <LuckChecker preset={preset} />;
  if (id === "mlm") return <MlmChecker preset={preset} />;
  return <IndicatorChecker preset={preset} />;
}
