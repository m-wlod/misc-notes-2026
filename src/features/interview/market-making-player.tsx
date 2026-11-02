"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { parseLocaleNumber } from "@/lib/math/parse-number";

import { LevelSetup } from "./level-setup";
import {
  generateRounds,
  MARKET_MAKING,
  settleQuote,
  type QuoteResult,
  type Round,
} from "./market-making";
import { newSeed, useSessionRunner } from "./runner";
import { ScorecardView } from "./scorecard-view";
import { remainingMs, scorecard } from "./session";
import { Timer } from "./timer";

type Settled = {
  round: Round;
  bid: number;
  ask: number;
  result: Extract<QuoteResult, { ok: true }>;
};

export function MarketMakingPlayer() {
  const t = useTranslations("interview");
  const format = useFormatter();
  const id = useId();
  const run = useSessionRunner<Round>("market_making");
  const [bid, setBid] = useState("");
  const [ask, setAsk] = useState("");
  const [error, setError] = useState<"crossed" | "invalid" | null>(null);
  const [settled, setSettled] = useState<Settled[]>([]);
  const [showing, setShowing] = useState<Settled | null>(null);
  // Read when the session is saved (in an event handler), so the total P&L is current.
  const pnls = useRef<number[]>([]);
  const nextButton = useRef<HTMLButtonElement>(null);
  // Move focus to "next" when a round's result appears (keyboard flow without autoFocus).
  useEffect(() => {
    if (showing) nextButton.current?.focus();
  }, [showing]);
  const { session } = run;
  const num = (v: number, digits = 2) => format.number(v, { maximumFractionDigits: digits });
  const signed = (v: number) =>
    format.number(v, { maximumFractionDigits: 2, signDisplay: "exceptZero" });

  if (!session) {
    return (
      <LevelSetup
        kind="market_making"
        rules={t("setup.rulesMarket")}
        onStart={(level) => {
          const seed = newSeed();
          pnls.current = [];
          setSettled([]);
          setShowing(null);
          run.setExtra(() => ({ pnl: pnls.current.reduce((a, b) => a + b, 0) }));
          run.start({
            level,
            seed,
            questions: generateRounds(seed),
            durationMs: MARKET_MAKING.durationMs,
          });
        }}
      />
    );
  }

  const outcome = (s: Settled) => {
    const sc = `market.scenarios.${s.round.scenario}` as const;
    return (
      <div className="grid gap-1 text-base text-ink">
        <p>
          {s.result.trade === "buy"
            ? t("market.bought", { price: num(s.ask) })
            : s.result.trade === "sell"
              ? t("market.sold", { price: num(s.bid) })
              : t("market.none")}{" "}
          {t("market.truth", { value: num(s.round.value) })}
        </p>
        <p className="num font-sans font-semibold">
          {t("market.pnl", { pnl: signed(s.result.pnl) })}
        </p>
        <p className="num">
          {t("market.ev", { ev: num(s.result.ev), sd: num(s.result.sd) })} {t(`${sc}.how`)}
        </p>
        <p>
          {s.result.evInside
            ? t("market.evInside", { width: num(s.result.width) })
            : t("market.evOutside")}
        </p>
        <p className="num font-sans text-sm text-ink-muted">
          {t("market.score", { percent: Math.round(s.result.score * 100) })}
        </p>
      </div>
    );
  };

  if (showing) {
    return (
      <div className="grid max-w-(--measure) gap-4">
        <section
          aria-labelledby={`${id}-result`}
          className={cx(
            "border-l-2 py-1 pl-4",
            showing.result.pnl > 0
              ? "border-correct"
              : showing.result.pnl < 0
                ? "border-wrong"
                : "border-rule-strong",
          )}
        >
          <h2 id={`${id}-result`} className="mb-2 font-sans text-base font-semibold">
            {t(`market.scenarios.${showing.round.scenario}.name`)}
          </h2>
          {outcome(showing)}
        </section>
        <div>
          <Button
            type="button"
            ref={nextButton}
            onClick={() => {
              setShowing(null);
            }}
          >
            {session.status === "finished" ? t("score.title") : t("market.next")}
          </Button>
        </div>
      </div>
    );
  }

  if (session.status === "finished") {
    return (
      <ScorecardView
        card={scorecard(session)}
        sessionId={run.id}
        pnl={settled.reduce((a, x) => a + x.result.pnl, 0)}
        onAgain={run.reset}
      >
        <ol className="grid gap-4">
          {settled.map((s) => (
            <li key={s.round.id}>
              <h3 className="mb-1 font-sans text-sm font-semibold">
                {t(`market.scenarios.${s.round.scenario}.name`)}: {num(s.bid)} / {num(s.ask)}
              </h3>
              {outcome(s)}
            </li>
          ))}
        </ol>
      </ScorecardView>
    );
  }

  const round = session.questions[session.index];
  if (!round) return null;
  return (
    <div className="grid max-w-(--measure) gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="num font-sans text-sm text-ink-muted">
          {t("market.round", { n: session.index + 1, total: session.questions.length })}
        </p>
        <Timer remaining={remainingMs(session, run.now)} />
      </div>
      <h2 className="font-serif text-2xl text-ink">
        {t(`market.scenarios.${round.scenario}.name`)}
      </h2>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const b = parseLocaleNumber(bid);
          const a = parseLocaleNumber(ask);
          if (!b.ok || !a.ok) {
            setError("invalid");
            return;
          }
          const result = settleQuote(round, b.value, a.value);
          if (!result.ok) {
            setError(result.reason);
            return;
          }
          setError(null);
          const s: Settled = { round, bid: b.value, ask: a.value, result };
          pnls.current = [...pnls.current, result.pnl];
          setSettled((prev) => [...prev, s]);
          setShowing(s);
          setBid("");
          setAsk("");
          run.answer({
            questionId: round.id,
            given: `${String(b.value)} / ${String(a.value)}`,
            score: result.score,
            topic: round.scenario,
          });
        }}
      >
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["bid", bid, setBid],
              ["ask", ask, setAsk],
            ] as const
          ).map(([key, value, set]) => (
            <div key={key} className="grid gap-1">
              <label htmlFor={`${id}-${key}`} className="font-sans text-sm text-ink">
                {t(`market.${key}`)}
              </label>
              <input
                id={`${id}-${key}`}
                inputMode="decimal"
                autoComplete="off"
                value={value}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => {
                  set(e.target.value);
                }}
                className="w-36 rounded border border-rule-strong bg-surface px-3 py-2 num text-lg text-ink"
              />
            </div>
          ))}
        </div>
        <p id={`${id}-error`} role="alert" className="min-h-5 text-sm text-wrong">
          {error ? t(`market.${error}`) : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{t("market.quote")}</Button>
          <Button type="button" variant="ghost" onClick={run.finish}>
            {t("player.finish")}
          </Button>
        </div>
      </form>
    </div>
  );
}
