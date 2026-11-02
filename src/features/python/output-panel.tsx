"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";

import type { RuntimeState } from "./client";
import { cleanPlot } from "./plot";
import { PlotView } from "./plot-view";
import type { RunOutput } from "./protocol";

/** What a run printed, returned, plotted or raised (Phase 13). */
export function OutputPanel({
  output,
  runtime,
  onStop,
}: {
  output: RunOutput | null;
  runtime: RuntimeState;
  onStop: () => void;
}) {
  const t = useTranslations("python");
  const format = useFormatter();
  const plots = useMemo(
    () => (output?.plots ?? []).map((p) => ({ clean: cleanPlot(p), xDates: p.xDates })),
    [output?.plots],
  );
  if (!output) return null;

  const busy =
    output.status === "queued" || output.status === "loading" || output.status === "running";
  let status: string | null = null;
  if (output.status === "queued") status = t("status.queued");
  else if (output.status === "loading") {
    status = runtime.packages
      ? t("status.packages", { names: runtime.packages.join(", ") })
      : runtime.phase === "ready"
        ? t("status.starting")
        : t("status.runtime");
  } else if (output.status === "running") status = t("status.running");

  return (
    <div data-python-output={output.status} className="mt-2 font-sans text-sm">
      <div aria-live="polite" className="flex min-h-8 flex-wrap items-center gap-3">
        {status ? <p className="text-ink-muted">{status}</p> : null}
        {busy ? (
          <Button type="button" size="sm" variant="secondary" onClick={onStop}>
            {t("stop")}
          </Button>
        ) : null}
        {output.status === "done" && output.ms !== null ? (
          <p className="text-xs text-ink-muted">
            {t("status.done", {
              time: format.number(output.ms / 1000, { maximumFractionDigits: 2 }),
            })}
          </p>
        ) : null}
        {output.stopped ? (
          <p role="status" className="text-wrong">
            {output.stopped === "timeout" ? t("status.timeout") : t("status.stopped")}
          </p>
        ) : null}
      </div>
      {output.stream.length > 0 ? (
        <pre
          data-stream=""
          className="mt-1 max-h-80 overflow-auto rounded-sm bg-sunken px-3 py-2 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap"
        >
          {output.stream.map((c, i) =>
            c.kind === "err" ? (
              <span key={i} className="text-wrong">
                {c.text}
              </span>
            ) : (
              <span key={i}>{c.text}</span>
            ),
          )}
        </pre>
      ) : null}
      {output.value !== null ? (
        <pre
          data-value=""
          className="mt-1 max-h-80 overflow-auto rounded-sm border border-rule px-3 py-2 font-mono text-xs break-words whitespace-pre-wrap"
        >
          {output.value.length > 20_000 ? `${output.value.slice(0, 20_000)}…` : output.value}
        </pre>
      ) : null}
      {output.error ? (
        <pre
          data-error=""
          className="mt-1 max-h-80 overflow-auto rounded-sm border border-wrong/50 px-3 py-2 font-mono text-xs break-words whitespace-pre-wrap text-wrong"
        >
          {output.error}
        </pre>
      ) : null}
      {output.refused === "matplotlib" ? (
        <p role="status" className="mt-1 text-wrong">
          {t("matplotlib")}
        </p>
      ) : null}
      {plots.map((p, i) => (
        <PlotView key={i} plot={p.clean} xDates={p.xDates} />
      ))}
    </div>
  );
}
