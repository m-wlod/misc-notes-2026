import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { getGlossary } from "@/features/content/lessons";
import { TermPopover } from "@/features/glossary/term-popover";
import { PythonCellClient } from "@/features/python/python-cell";
import { Simulation as SimulationEmbed } from "@/features/sims/embed";
import { simById } from "@/features/sims/registry";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";

import { EquationBlock } from "./equation-block";
import { FigureFrame } from "./figure-frame";
import { MarginNote } from "./margin-note";
import { WalkChart } from "./walk-chart";

/**
 * Lesson building blocks used in MDX (CLAUDE.md "Content model"). Server components;
 * labels come from the `content` messages, text from the lesson. Numbers (`number`, `n`)
 * are filled in at build time by src/features/content/rehype-numbering.ts.
 */

type Children = { children?: ReactNode };
type Titled = Children & { title?: string | undefined };

const labelClass = "font-sans text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase";

/** Shared frame: small uppercase label, optional title, left rule. */
function Block({
  label,
  title,
  rule = "border-rule-strong",
  className,
  children,
}: Titled & { label: string; rule?: string; className?: string }) {
  return (
    <section role="note" className={cx("my-7 border-l-2 py-1 pl-5", rule, className)}>
      <p className={cx(labelClass, "mb-1.5")}>
        {label}
        {title ? <span className="tracking-normal normal-case">{` · ${title}`}</span> : null}
      </p>
      <div className="[&>:last-child]:mb-0">{children}</div>
    </section>
  );
}

export async function Intuition({ children }: Children) {
  const t = await getTranslations("content");
  return (
    <Block label={t("intuition")} rule="border-accent" className="italic">
      {children}
    </Block>
  );
}

export async function Definition({ title, children }: Titled) {
  const t = await getTranslations("content");
  return (
    <Block label={t("definition")} title={title} rule="border-ink">
      {children}
    </Block>
  );
}

export async function Theorem({ title, children }: Titled) {
  const t = await getTranslations("content");
  return (
    <Block label={t("theorem")} title={title} rule="border-ink">
      {children}
    </Block>
  );
}

export async function Example({ title, children }: Titled) {
  const t = await getTranslations("content");
  return (
    <Block label={t("example")} title={title}>
      {children}
    </Block>
  );
}

export async function InterviewTip({ children }: Children) {
  const t = await getTranslations("content");
  return <Block label={t("interviewTip")}>{children}</Block>;
}

/** Collapsed by default; a native <details>, so keyboard and screen readers just work. */
export async function Proof({ children }: Children) {
  const t = await getTranslations("content");
  return (
    <details className="group my-7 border-l-2 border-rule py-1 pl-5">
      <summary
        className={cx(
          labelClass,
          "cursor-pointer list-none rounded-sm text-ink",
          "before:mr-2 before:inline-block before:content-['▸'] group-open:before:rotate-90",
        )}
      >
        {t("proof")}
      </summary>
      <div className="mt-3 [&>:last-child]:mb-0">
        {children}
        <span aria-hidden="true" className="float-right text-ink-muted">
          ∎
        </span>
      </div>
    </details>
  );
}

/** A display equation, numbered at build time. `id` lets <EqRef> link to it. */
export async function Equation({ number, children }: Children & { number: string }) {
  const t = await getTranslations("content");
  return (
    <div id={`eq-${number}`} className="scroll-mt-24">
      <EquationBlock number={number} label={t("equation", { number })}>
        {children}
      </EquationBlock>
    </div>
  );
}

export async function EqRef({ number }: { to: string; number: string }) {
  const t = await getTranslations("content");
  return (
    <a
      href={`#eq-${number}`}
      aria-label={t("equationRef", { number })}
      className="num text-accent-text underline-offset-2 hover:underline"
    >
      ({number})
    </a>
  );
}

/** The one formula to remember from a lesson: the equation inside is numbered as usual. */
export async function KeyFormula({ children }: Children) {
  const t = await getTranslations("content");
  return (
    <section role="note" className="my-8 rounded-md border border-rule-strong bg-surface px-5 py-3">
      <p className={labelClass}>{t("keyFormula")}</p>
      <div>{children}</div>
    </section>
  );
}

export async function Sidenote({ n, children }: Children & { n: string }) {
  const t = await getTranslations("content");
  return (
    <MarginNote n={Number(n)} srLabel={t("sidenote")}>
      {children}
    </MarginNote>
  );
}

export async function Figure({
  number,
  caption,
  meta,
  children,
}: Children & { number: string; caption: string; meta?: string }) {
  const t = await getTranslations("content");
  return (
    <FigureFrame number={number} prefix={t("figure")} meta={meta} caption={caption}>
      {children}
    </FigureFrame>
  );
}

/** The design-system random-walk chart, usable from MDX (no functions in props). */
export async function RandomWalk({
  seed,
  days = 250,
  sigma = 0.01,
}: {
  seed: number;
  days?: number;
  sigma?: number;
}) {
  const t = await getTranslations("content");
  const locale = await getLocale();
  const one = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return (
    <WalkChart
      seed={seed}
      days={days}
      sigma={sigma}
      format={(v) => one.format(v)}
      describe={(s) =>
        t("walk.describe", {
          days: s.days,
          start: one.format(s.start),
          end: one.format(s.end),
          min: one.format(s.min),
          max: one.format(s.max),
        })
      }
    />
  );
}

/**
 * A common false claim, why it's false (the math is the children), and a link to the
 * Debunk Lab. TODO(phase-16): link to the matching entry (`debunk` id) once entries exist.
 */
export async function GuruMyth({ claim, children }: Children & { claim: string; debunk?: string }) {
  const t = await getTranslations("content");
  return (
    <section role="note" className="my-8 border-l-2 border-wrong py-1 pl-5">
      <p className={cx(labelClass, "mb-2")}>{t("guruMyth.label")}</p>
      <blockquote className="mb-4 text-lg italic">„{claim}”</blockquote>
      <p className="mb-2 font-sans text-base font-semibold">{t("guruMyth.why")}</p>
      <div className="[&>:last-child]:mb-0">{children}</div>
      <p className="mt-3 font-sans text-sm">
        <Link href="/debunk" className="text-accent-text underline underline-offset-2">
          {t("guruMyth.debunk")}
        </Link>
      </p>
    </section>
  );
}

/** Placeholder until the simulation registry exists. TODO(phase-11): render the sim by id. */
/**
 * `<Simulation id="…" caption="…" />`: the live simulation when the id exists in the Lab
 * (Phase 12), otherwise a labelled placeholder for one that is still to come.
 */
export async function Simulation({ id, caption }: { id: string; caption?: string }) {
  const t = await getTranslations("content");
  if (simById(id)) {
    return (
      <figure data-simulation={id} className="my-8">
        <SimulationEmbed id={id} />
        {caption ? (
          <figcaption className="mt-2 text-base text-ink-muted">{caption}</figcaption>
        ) : null}
      </figure>
    );
  }
  return (
    <figure
      data-simulation={id}
      className="my-8 rounded-md border border-dashed border-rule-strong bg-sunken px-5 py-4"
    >
      <p className={labelClass}>{t("simulation.label")}</p>
      {caption ? <figcaption className="mt-1 text-base">{caption}</figcaption> : null}
      <p className="mt-2 font-sans text-sm text-ink-muted">{t("simulation.soon")}</p>
    </figure>
  );
}

/**
 * Runnable Python (Phase 13): the highlighted code is rendered here, on the server; the
 * client island adds Run and Edit and loads Pyodide only when the reader uses them.
 */
export async function PythonCell({ children }: Children) {
  const t = await getTranslations("content");
  return (
    <div className="my-7">
      <p className={cx(labelClass, "mb-1.5")}>{t("pythonCell.label")}</p>
      <PythonCellClient>{children}</PythonCellClient>
    </div>
  );
}

/** Debunk Lab entry: the maths behind the verdict (Phase 16). */
export async function TheMath({ children }: Children) {
  const t = await getTranslations("content");
  return (
    <section data-block="the-math" className="my-8">
      <h2 className="mb-4 font-serif text-xl text-ink">{t("theMath")}</h2>
      <div className="[&>:last-child]:mb-0">{children}</div>
    </section>
  );
}

/** Debunk Lab entry: what to do instead (Phase 16). */
export async function WhatToDoInstead({ children }: Children) {
  const t = await getTranslations("content");
  return (
    <section
      data-block="instead"
      className="my-8 rounded-md border border-rule-strong bg-surface px-5 py-4"
    >
      <h2 className="mb-3 font-serif text-xl text-ink">{t("whatInstead")}</h2>
      <div className="[&>:last-child]:mb-0">{children}</div>
    </section>
  );
}

/** Link to a practice exercise (its page decides visibility: published, or internal). */
export async function ExerciseRef({ id, title }: { id: string; title?: string }) {
  const t = await getTranslations("content");
  return (
    <div data-exercise={id} className="my-8 rounded-md border border-rule-strong px-5 py-4">
      <p className={labelClass}>{t("exerciseRef.label")}</p>
      <p className="mt-1 text-base">
        <Link
          href={{ pathname: "/practice/[exercise]", params: { exercise: id } }}
          className="text-accent-text underline underline-offset-2"
        >
          {title ?? id}
        </Link>
      </p>
    </div>
  );
}

/**
 * A passage for one depth: "easy" (Po ludzku) or "formal" (Podręcznik). Both are in the
 * HTML; CSS shows the one chosen with the lesson's depth toggle (src/config/depth.ts).
 * Content outside <Depth> shows in both modes.
 */
export function Depth({ level, children }: Children & { level: "easy" | "formal" }) {
  return <div className={level === "easy" ? "depth-easy" : "depth-formal"}>{children}</div>;
}

/**
 * A glossary term in running text: `<Term id="variance">wariancja</Term>`. Unknown ids
 * fail the content build, so the lookup here always succeeds for built content.
 */
export async function Term({ id, children }: Children & { id: string }) {
  const term = getGlossary().find((g) => g.id === id);
  if (!term) return <>{children}</>;
  const locale = await getLocale();
  const t = await getTranslations("glossary");
  return (
    <TermPopover
      id={id}
      name={term.name[locale]}
      definition={term.definition[locale]}
      linkLabel={t("inGlossary")}
    >
      {children}
    </TermPopover>
  );
}

/** The whole body of a lesson that is listed in the curriculum but not written yet. */
export async function Stub() {
  const t = await getTranslations("content");
  return (
    <p role="note" className="my-6 border-l-2 border-rule-strong py-1 pl-5 font-sans text-base">
      {t("stub")}
    </p>
  );
}
