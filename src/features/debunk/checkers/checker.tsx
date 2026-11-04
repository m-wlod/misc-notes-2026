"use client";

import { useRef } from "react";

import { track } from "@/features/analytics/client";

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
  const used = useRef(false);
  // The first change to any input counts as using the checker (Phase 22b analytics).
  const onChange = () => {
    if (used.current) return;
    used.current = true;
    track("feature_used", { feature: "debunk_checker", id });
  };
  const inner =
    id === "ev" ? (
      <EvChecker preset={preset} />
    ) : id === "luck" ? (
      <LuckChecker preset={preset} />
    ) : id === "mlm" ? (
      <MlmChecker preset={preset} />
    ) : (
      <IndicatorChecker preset={preset} />
    );
  return <div onChangeCapture={onChange}>{inner}</div>;
}
