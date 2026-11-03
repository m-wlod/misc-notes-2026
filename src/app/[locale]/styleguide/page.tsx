import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { DataRule, StatTicker } from "@/components/content/data";
import { EquationBlock } from "@/components/content/equation-block";
import { FigureFrame } from "@/components/content/figure-frame";
import { MarginNote, ReadingColumn } from "@/components/content/margin-note";
import { VideoEmbed } from "@/components/content/video-embed";
import { WalkChart } from "@/components/content/walk-chart";
import { ThemeControl } from "@/components/shell/controls";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Kbd, Progress, Skeleton, Table, Td, Th } from "@/components/ui/display";
import { Link } from "@/components/ui/link";
import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { CertificatesPanel } from "@/features/certificates/certificates-panel";
import { Checker } from "@/features/debunk/checkers/checker";
import { CHECKER_IDS } from "@/features/debunk/checkers/ids";
import { renderText } from "@/features/exercises/render-text";
import { AchievementsGrid } from "@/features/gamification/ui/achievements-grid";
import { Dashboard } from "@/features/gamification/ui/dashboard";
import { LeagueTable } from "@/features/gamification/ui/league-table";
import { SkillRadar } from "@/features/gamification/ui/skill-radar";
import { NotificationSettings } from "@/features/notify/notification-settings";
import { ReviewSession } from "@/features/review/review-session";
import { randomWalk } from "@/lib/math/rng";

import { CelebrationDemo, FieldDemos, OverlayDemos, TabDemos } from "./demos";

// Internal tool at /[locale]/styleguide. TODO(phase-18): also allow admins in production.
// Documented i18n exception (CLAUDE.md): chrome is English and the samples are Polish
// design specimens (diacritics, number formats), so they are not translated.

export const metadata: Metadata = {
  title: "Style guide",
  robots: { index: false, follow: false },
};

export default function StyleguidePage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  );
}

/**
 * Request-time check (review M11). proxy.ts already returns 404; this is the server-side
 * backstop so the page can never be prerendered into a production build.
 */
async function Gate() {
  await connection();
  if (!isStyleguideEnabled(env)) notFound();
  return <Styleguide />;
}

const COLOURS = [
  ["bg", "Page background"],
  ["surface", "Inputs, raised panels"],
  ["sunken", "Code, table header, hover"],
  ["ink", "Text"],
  ["ink-muted", "Secondary text"],
  ["rule", "Hairlines"],
  ["rule-strong", "Control borders (3:1)"],
  ["grid", "Chart grid"],
  ["accent", "Action fills"],
  ["accent-text", "Links, accent text"],
  ["on-accent", "Text on accent fills"],
  ["focus", "Focus ring"],
  ["correct", "Correct answer"],
  ["wrong", "Wrong answer"],
  ["data-up", "Rising number"],
  ["data-down", "Falling number"],
] as const;

const RADII = [
  ["--r-sm", "rounded-sm", "2px · badges, checkboxes, kbd"],
  ["--r", "rounded", "3px · buttons, inputs, panels"],
  ["--r-md", "rounded-md", "4px · maximum"],
] as const;

const MOTION = [
  ["--duration-fast", "100ms", "hover colour"],
  ["--duration", "150ms", "the maximum for any transition"],
  ["--ease", "cubic-bezier(0.2, 0, 0, 1)", "standard easing"],
] as const;

const LAYERS = [
  ["--z-sticky", "10"],
  ["--z-dropdown", "20"],
  ["--z-overlay", "40"],
  ["--z-modal", "50"],
  ["--z-toast", "60"],
] as const;

const DIACRITICS = "Zażółć gęślą jaźń — 0,25 → 25%";
const pl1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const pl0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });

function Styleguide() {
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
          position. Red and green only mean correct/wrong or a rising/falling number. Contrast for
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
        <Table caption="Type scale" label="Type scale" className="mt-8 max-w-xl">
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
              ["text-2xs", "11", "Chart ticks, figure parameters"],
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

      <Section id="shape" title="Spacing, radii, motion, layers">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 font-sans text-sm font-medium">Spacing</h3>
            <p className="mb-4 text-sm text-ink-muted">
              Tailwind’s 4px step (<span className="num">--spacing: 0.25rem</span>). Prefer 1, 2, 3,
              4, 6, 8, 12, 16.
            </p>
            <ul className="grid gap-2">
              {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
                <li key={n} className="flex items-center gap-3">
                  <span className="w-8 num text-xs text-ink-muted">{n}</span>
                  <span
                    className="h-2 bg-ink-muted"
                    style={{ width: `${String(n * 4)}px` }}
                    aria-hidden="true"
                  />
                  <span className="num text-xs text-ink-muted">{n * 4}px</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-8">
            <TokenTable label="Radii" head={["Token", "Class", "Value · use"]} rows={RADII} />
            <TokenTable label="Motion" head={["Token", "Value", "Use"]} rows={MOTION} />
            <TokenTable label="Layers" head={["Token", "z-index"]} rows={LAYERS} />
          </div>
        </div>
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
            <MarginNote n={1} srLabel="Przypis">
              Przybliżenie poniżej wynika z rozwinięcia Taylora ln(1 + x) ≈ x − x²/2. Przy dużych
              zwrotach jest coraz mniej dokładne.
            </MarginNote>
          </p>
          <EquationBlock number="4.1" label="Równanie (4.1)">
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
              days={250}
              format={(v) => pl1.format(v)}
              describe={(s) =>
                `Wykres błądzenia losowego przez ${pl0.format(s.days)} dni: start ${pl1.format(s.start)}, ` +
                `koniec ${pl1.format(s.end)}, zakres od ${pl1.format(s.min)} do ${pl1.format(s.max)}.`
              }
            />
          </FigureFrame>
          <Callout label="Mit">
            <p className="italic">
              „Strategia zarabia średnio +1% na transakcję, więc musi zarabiać.”
            </p>
            <p className="mb-0">
              Przy σ = 10% spadek zmienności to 0,5%. Po kosztach 0,6% oczekiwany wzrost kapitału
              wynosi <span className="text-data-down">−0,1%</span> na transakcję.
            </p>
          </Callout>
        </ReadingColumn>
        <div className="mt-8 max-w-(--measure)">
          {/* Click-to-load video facade (Phase 6b). Placeholder id: nothing loads until play. */}
          <VideoEmbed
            url="https://www.youtube.com/watch?v=aaaaaaaaaaa"
            title="Przykładowe wideo (demonstracja komponentu)"
          />
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <StatTicker label="Seria" value="12" unit="dni" />
          <StatTicker label="XP" value="1 240" />
          <StatTicker label="Liga" value="Gauss" />
        </div>
        <DataRule
          values={randomWalk({ points: 60, sigma: 0.02, seed: 3 })}
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
          Więcej w lekcji <Link href="#lesson">Kryterium Kelly’ego</Link> i w{" "}
          <Link href="#lesson" quiet>
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
          <Badge>Nowe</Badge>
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
        <Table
          caption="Poziom 2 · statystyki zadań (przykładowe dane)"
          label="Statystyki zadań, przykładowe dane"
          className="max-w-2xl"
        >
          <thead>
            <tr>
              <Th>Zadanie</Th>
              <Th numeric>Skuteczność</Th>
              <Th numeric>Mediana czasu</Th>
              <Th numeric>Δ tydzień</Th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Odrabianie straty 20%", "71%", "0:48", "+3,1", true],
                ["Seria 6 strat przy 55%", "38%", "2:12", "−1,4", false],
                ["Wariancja sumy", "54%", "1:35", "+0,6", true],
              ] as const
            ).map(([name, rate, time, delta, up]) => (
              <tr key={name}>
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

      <Section id="checkers" title="Debunk Lab claim checkers">
        <div className="grid gap-10">
          {CHECKER_IDS.map((id) => (
            <div key={id} data-specimen={`checker-${id}`}>
              <p className="mb-2 font-sans text-xs text-ink-muted">{id}</p>
              <Checker id={id} />
            </div>
          ))}
        </div>
      </Section>

      <Section id="gamification" title="Gamification (sample data)">
        <p className="mb-6 max-w-(--measure) text-sm text-ink-muted">
          Signed-in only, dormant until accounts are on: shown here with sample data.
        </p>
        <div className="grid gap-10">
          <Dashboard
            data={{
              todayXp: 30,
              goal: 50,
              streak: { current: 6, freezes: 1, atRisk: true, repairable: null },
              league: { kind: "member", tierName: "Gauss", rank: 4, size: 28 },
              nextLesson: null,
              recommended: { title: "Wartość oczekiwana rzutu kostką", level: 1, href: "#" },
              problem: null,
              reviewDue: 7,
            }}
          />
          <LeagueTable
            data={{
              tierName: "Gauss",
              mode: "split",
              me: "u4",
              members: Array.from({ length: 10 }, (_, i) => ({
                userId: `u${String(i + 1)}`,
                handle: `gracz_${String(i + 1)}`,
                weeklyXp: 520 - i * 45,
                rank: i + 1,
              })),
            }}
          />
          <SkillRadar
            ratings={[
              { topic: "prawdopodobieństwo", rating: 1240 },
              { topic: "statystyka", rating: 1080 },
              { topic: "opcje", rating: 960 },
              { topic: "ryzyko", rating: 1310 },
              { topic: "szeregi czasowe", rating: 1010 },
            ]}
          />
          <AchievementsGrid owned={new Set(["pierwszy-krok", "seria-3", "seria-7", "xp-100"])} />
          <CelebrationDemo />
          <div className="grid gap-3" data-specimen="review">
            <p className="font-sans text-xs text-ink-muted">Review card (demo: rates locally)</p>
            <ReviewSession
              demo
              now="2026-11-02T18:00:00.000Z"
              items={[
                {
                  cardId: "lesson:demo:def:wartosc-oczekiwana",
                  kind: "definition",
                  source: "Wartość oczekiwana",
                  frontHtml: renderText("Wartość oczekiwana"),
                  backHtml: renderText(
                    "Średnia ważona prawdopodobieństwami: $E[X] = \\sum_i p_i x_i$.",
                  ),
                  href: null,
                  next: {
                    again: "2026-11-03T18:00:00.000Z",
                    hard: "2026-11-04T18:00:00.000Z",
                    good: "2026-11-05T18:00:00.000Z",
                    easy: "2026-11-17T18:00:00.000Z",
                  },
                },
              ]}
            />
          </div>
          <div data-specimen="certificates">
            <CertificatesPanel
              tracks={[
                {
                  id: "foundations",
                  name: "Fundamenty",
                  progress: { lessonsTotal: 6, lessonsDone: 6, mastery: 0.86 },
                  certificateId: "0b9e7c1e-1d2a-4f5b-9c8d-1234567890ab",
                },
                {
                  id: "probability",
                  name: "Prawdopodobieństwo",
                  progress: { lessonsTotal: 9, lessonsDone: 4, mastery: 0.55 },
                  certificateId: null,
                },
              ]}
            />
          </div>
          <div data-specimen="notifications">
            <NotificationSettings
              demo
              vapidKey={null}
              initial={{
                streak: true,
                weekly: false,
                league: true,
                push: false,
                quietStart: "22:00",
                quietEnd: "07:00",
              }}
            />
          </div>
          <figure className="grid gap-2" data-specimen="share">
            {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG specimen */}
            <img
              src="/api/share/daily?d=2026-11-02&l=3&r=xxo&h=1&lang=pl&format=og"
              alt="Karta wyniku zadania dnia: poziom 3, rozwiązane za trzecim razem, jedna podpowiedź"
              width={600}
              height={315}
              className="h-auto w-full max-w-[600px] rounded-md border border-rule"
            />
            <figcaption className="font-sans text-xs text-ink-muted">
              Share card (1200×630; the story format is 1080×1920)
            </figcaption>
          </figure>
        </div>
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

function TokenTable({
  label,
  head,
  rows,
}: {
  label: string;
  head: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  return (
    <Table caption={label} label={label}>
      <thead>
        <tr>
          {head.map((h) => (
            <Th key={h}>{h}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]}>
            {r.map((cell, i) => (
              <Td key={cell} className={i < 2 ? "num" : undefined}>
                {cell}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
