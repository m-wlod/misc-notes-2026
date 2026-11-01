import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DataRule, StatTicker } from "@/components/content/data";
import { EquationBlock } from "@/components/content/equation-block";
import { FigureFrame } from "@/components/content/figure-frame";
import { MarginNote, ReadingColumn } from "@/components/content/margin-note";
import { WalkChart } from "@/components/content/walk-chart";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Kbd, Progress, Skeleton, Table, Td, Th } from "@/components/ui/display";
import { Link } from "@/components/ui/link";
import { env } from "@/env";
import { randomWalk } from "@/lib/math/rng";

import { FieldDemos, OverlayDemos, TabDemos } from "./demos";
import { ThemeControl } from "./theme-control";

// TODO(phase-2): move to /[locale]/styleguide. TODO(phase-18): also allow admins in production.
// Internal tool: chrome is English, samples are Polish (what users will see).

export const metadata: Metadata = {
  title: "Style guide",
  robots: { index: false, follow: false },
};

const COLOURS = [
  ["bg", "Page background"],
  ["surface", "Inputs, raised panels"],
  ["sunken", "Code, table header, hover"],
  ["ink", "Text"],
  ["ink-muted", "Secondary text"],
  ["rule", "Hairlines"],
  ["rule-strong", "Control borders (3:1)"],
  ["grid", "Chart grid"],
  ["accent", "Actions, focus (fills)"],
  ["accent-text", "Links, accent text"],
  ["correct", "Correct answer, data up"],
  ["wrong", "Wrong answer, data down"],
] as const;

const DIACRITICS = "Zażółć gęślą jaźń — 0,25 → 25%";
const pl = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function StyleguidePage() {
  if (env.VERCEL_ENV === "production") notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-24 sm:px-6">
      <header className="mb-12 flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-6">
        <div>
          <p className="mb-2 num text-xs text-ink-muted">
            design system · direction A, research note
          </p>
          <h1 className="text-3xl">Style guide</h1>
        </div>
        <ThemeControl />
      </header>

      <Section id="colour" title="Colour">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {COLOURS.map(([token, use]) => (
            <li key={token} className="flex items-center gap-3">
              <span
                className="size-10 shrink-0 rounded-sm border border-rule"
                style={{ background: `var(--${token})` }}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block num text-sm text-ink">--{token}</span>
                <span className="block text-xs text-ink-muted">{use}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-prose text-sm text-ink-muted">
          Neutrals carry the interface. Orange appears only on actions, focus and the current
          position. Red and green only mean correct/wrong or a rising/falling number; contrast for
          every pair is checked in <span className="num">src/styles/tokens.test.ts</span>.
        </p>
      </Section>

      <Section id="type" title="Type">
        <div className="grid gap-6">
          <Specimen label="Serif · Newsreader · headings and reading" className="font-serif">
            <p className="text-3xl">Stopy logarytmiczne</p>
            <p className="text-xl">Spadek zmienności</p>
            <p className="text-reading">{DIACRITICS}</p>
            <p className="text-reading italic">„Strategia zarabia średnio +1% na transakcję.”</p>
          </Specimen>
          <Specimen label="Sans · IBM Plex Sans · interface" className="font-sans">
            <p className="text-lg font-medium">Praktyka · Rozmowa · Debunk Lab</p>
            <p className="text-base">{DIACRITICS}</p>
            <p className="text-sm text-ink-muted">Poziom 2 · Średnio · 12 min</p>
          </Specimen>
          <Specimen label="Mono · IBM Plex Mono · numbers, code, tickers" className="font-mono">
            <p className="num text-base">{DIACRITICS}</p>
            <p className="num text-base">1 240,50 · −0,1% · σ = 0,01 · (4.1)</p>
          </Specimen>
        </div>
        <Table caption="Type scale" className="mt-8 max-w-xl">
          <thead>
            <tr>
              <Th>Token</Th>
              <Th numeric>Size</Th>
              <Th>Use</Th>
            </tr>
          </thead>
          <tbody>
            {[
              ["text-3xl", "44", "Lesson title"],
              ["text-xl", "26", "Section heading"],
              ["text-reading", "19", "Lesson body"],
              ["text-base", "15", "Interface"],
              ["text-sm", "13", "Notes, captions"],
              ["text-xs", "12", "Labels, meta"],
            ].map(([t, px, use]) => (
              <tr key={t}>
                <Td className="num">{t}</Td>
                <Td numeric>{px}px</Td>
                <Td>{use}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section id="lesson" title="Lesson components">
        <p className="mb-6 text-sm text-ink-muted">
          MarginNote, EquationBlock and FigureFrame inside the 68ch reading column. Margin notes
          move into the right margin above 80rem and sit inline below it.
        </p>
        <ReadingColumn>
          <h2 className="mb-3.5 text-xl">Spadek zmienności</h2>
          <p>
            Jeśli kurs rośnie o 50%, a potem spada o 50%, nie wracasz do punktu wyjścia: zostaje ci
            75% kapitału. Średnia arytmetyczna obu zwrotów wynosi zero, a mimo to kapitał zmalał.
            <MarginNote n={1}>
              Przybliżenie poniżej wynika z rozwinięcia Taylora ln(1 + x) ≈ x − x²/2. Przy dużych
              zwrotach jest coraz mniej dokładne.
            </MarginNote>
          </p>
          <EquationBlock number="4.1">
            <span className="font-serif text-lg italic">
              E[ln(1 + R)] ≈ μ − σ<sup>2</sup>/2
            </span>
          </EquationBlock>
          <p>
            Średni wzrost kapitału jest niższy od średniego zwrotu o połowę wariancji. Przy
            zmienności 20% rocznie to dwa punkty procentowe rocznie.
          </p>
          <FigureFrame
            prefix="Rys."
            number="3.2"
            meta="μ = 0 · σ = 1% dziennie · 250 dni · seed 7"
            caption="Błądzenie losowe bez żadnej przewagi. Każdy „trend” na tym wykresie to szum."
          >
            <WalkChart
              seed={7}
              label="Wykres błądzenia losowego przez 250 dni, od 100 do około 98"
              formatValue={(v) => pl.format(v)}
            />
          </FigureFrame>
          <Callout tone="accent" label="Mit">
            <p className="italic">
              „Strategia zarabia średnio +1% na transakcję, więc musi zarabiać.”
            </p>
            <p className="mb-0 text-[1.0625rem]">
              Przy σ = 10% spadek zmienności to 0,5%. Po kosztach 0,6% oczekiwany wzrost kapitału
              wynosi <span className="text-wrong">−0,1%</span> na transakcję.
            </p>
          </Callout>
        </ReadingColumn>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <StatTicker label="Seria" value="12" unit="dni" />
          <StatTicker label="XP" value="1 240" />
          <StatTicker label="Liga" value="Gauss" />
        </div>
        <DataRule
          values={randomWalk({ steps: 60, sigma: 0.02, seed: 3 })}
          label="Ozdobna linia: 60 dni błądzenia losowego"
        />
        <DataRule />
      </Section>

      <Section id="buttons" title="Buttons and links">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Sprawdź</Button>
          <Button variant="secondary">Pokaż podpowiedź</Button>
          <Button variant="ghost">Pomiń</Button>
          <Button size="sm">Dalej</Button>
          <Button disabled>Wyłączony</Button>
        </div>
        <p className="mt-6 font-serif text-reading">
          Więcej w lekcji <Link href="/styleguide#lesson">Kryterium Kelly’ego</Link> i w{" "}
          <Link href="/styleguide#lesson" quiet>
            spisie treści
          </Link>
          . Skróty: <Kbd>Enter</Kbd> sprawdza, <Kbd>H</Kbd> podpowiedź, <Kbd>N</Kbd> następne.
        </p>
      </Section>

      <Section id="fields" title="Form fields">
        <FieldDemos />
      </Section>

      <Section id="tabs" title="Tabs">
        <TabDemos />
      </Section>

      <Section id="overlays" title="Dialog, popover, tooltip, toast">
        <OverlayDemos />
      </Section>

      <Section id="status" title="Badges, progress, skeleton">
        <div className="flex flex-wrap gap-2">
          <Badge>Szkic</Badge>
          <Badge tone="accent">Nowe</Badge>
          <Badge tone="correct">Rozwiązane</Badge>
          <Badge tone="wrong">Błąd w treści</Badge>
        </div>
        <div className="mt-6 grid max-w-sm gap-2">
          <Progress value={38} aria-label="Postęp lekcji" />
          <p className="num text-xs text-ink-muted">7 min do końca</p>
        </div>
        <div className="mt-6 grid max-w-md gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </Section>

      <Section id="table" title="Table">
        <Table caption="Poziom 2 · statystyki zadań (przykładowe dane)" className="max-w-2xl">
          <thead>
            <tr>
              <Th>Zadanie</Th>
              <Th numeric>Skuteczność</Th>
              <Th numeric>Mediana czasu</Th>
              <Th numeric>Δ tydzień</Th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Odrabianie straty 20%", "71%", "0:48", "+3,1", true],
              ["Seria 6 strat przy 55%", "38%", "2:12", "−1,4", false],
              ["Wariancja sumy", "54%", "1:35", "+0,6", true],
            ].map(([name, rate, time, delta, up]) => (
              <tr key={String(name)}>
                <Td>{name}</Td>
                <Td numeric>{rate}</Td>
                <Td numeric>{time}</Td>
                <Td numeric className={up ? "text-data-up" : "text-data-down"}>
                  {delta}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mb-16 scroll-mt-8">
      <h2 id={`${id}-h`} className="mb-6 border-b border-rule pb-2 text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Specimen({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-l border-rule pl-4">
      <p className="mb-1 text-xs tracking-[0.06em] text-ink-muted uppercase">{label}</p>
      <div className={className}>{children}</div>
    </div>
  );
}
