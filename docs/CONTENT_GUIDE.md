# Content guide

The operating manual for writing lessons and exercises. A new Claude Code session should be able to produce a module from this file, the inbox brief (`pnpm content:draft`) and `src/components/content/README.md`, with no extra explanation.

> **Status (2026-11-01):** the site is built first. No real lessons or exercises are written until it is finished; this guide and the tooling are ready for that separate task.

## 1. Voice

- **A mentor, not a guru.** Calm, precise, honest about uncertainty. We explain why things work and when they don't; we never promise profit.
- **Polish first.** Write the Polish lesson, then the English translation (same `id`, its own `slug`). Natural Polish, not translated English: "wartość oczekiwana", not "expected value" in Polish text.
- **Short sentences.** One idea per sentence, one topic per paragraph. Prefer verbs to nouns ("liczymy", not "dokonujemy obliczenia").
- **Intuition before formalism.** Start with a picture or a bet the reader can imagine, then the definition, then the proof.
- **Numbers the reader can check.** Every worked example uses concrete values and gives the result. Polish decimals inside math: `0{,}52`.
- **No hype words.** Avoid "rewolucyjny", "sekret", "gwarantowany", "każdy może", exclamation marks, and second-person pressure ("musisz to wiedzieć!").
- **Anti-guru, not anti-reader.** Debunk claims, never mock people. Phrase myths generically ("90% skuteczności = pewny zysk"), never naming a person or channel.

Good: _Średnio tracisz 4 grosze na każdej złotówce stawki. Na krótkiej serii możesz wygrać; na długiej prawie na pewno przegrasz._
Bad: _To SZOKUJĄCE, ale kasyno ZAWSZE wygrywa, a guru ci tego nie powiedzą!!!_

## 2. Copyright (non-negotiable)

Books and NotebookLM output are **sources, not text to copy**.

- Write every sentence in our own words. Restructure the explanation; don't paraphrase sentence by sentence.
- Cite in the lesson's `sources` (book, chapter, page).
- Quote at most one sentence, in quotation marks, and only when the exact wording matters.
- Exercises are original or substantially transformed: new numbers, a new context, a new question. Never copy a book's problem with its numbers.
- Figures are drawn by us (our chart components), never scanned or traced.

## 3. Lesson template

File: `content/pl/tracks/<track>/<module>/<lesson-id>.mdx`. The stub already exists with the right `id`, `slug`, `level` and `prerequisites`; replace the `<Stub />` body.

```mdx
---
id: kelly-criterion            # never changes
slug: kryterium-kelly          # URL, per locale
locale: pl
title: "Kryterium Kelly'ego"
summary: One or two sentences: what the reader will be able to do.
level: 3
prerequisites: [expected-value, log-returns]
estimatedMinutes: 18
status: draft                  # draft → review → published
sources:
  - book: "Autor, Tytuł"
    chapter: "4"
    page: 87
glossaryTerms: [expected-value]
---

<Intuition>The idea in two or three sentences, before any formula.</Intuition>

## First section (h2: these become the table of contents)

Explanation with <Term id="expected-value">wartość oczekiwana</Term> linked once per lesson.

<Depth level="easy">Plain-words version.</Depth>
<Depth level="formal">Textbook version, inline math only.</Depth>

<Definition title="…">…$$ … \label{name} $$…</Definition>
<Example title="…">
  Concrete numbers, then <EqRef to="name" />.
</Example>
<CheckYourself answer="0.25">A quick, ungraded question.</CheckYourself>
<KeyFormula>$$ … $$</KeyFormula>
<GuruMyth claim="…">Why it fails, with the math.</GuruMyth>
<InterviewTip>How this comes up in quant interviews.</InterviewTip>
<ExerciseRef id="kelly-even-money" title="…" />
```

Rules:

- 800–2000 words of Polish for a 10–20 minute lesson; `estimatedMinutes` ≈ words / 120 plus time for exercises shown in the lesson.
- Every h2 is a step in the argument. 3–6 sections.
- At least one `<Intuition>`, one worked `<Example>` with numbers, one `<KeyFormula>`.
- Use `<Depth>` only where the two explanations really differ; shared text stays outside. Keep display equations out of `<Depth>`.
- One `<CheckYourself>` after each hard step: ungraded, instant, nothing stored.
- Margin notes (`<Sidenote>`) for asides and caveats, never for the main argument.
- Link prerequisites in the text where they matter; link glossary terms once.

## 4. The five levels

| Level | Label        | Who                        | Example task                                                             |
| ----- | ------------ | -------------------------- | ------------------------------------------------------------------------ |
| 1     | Podstawy     | After high school          | Expected value of a die roll; loss needed to recover from a 50% drawdown |
| 2     | Średnio      | First-year university      | Variance of a sum; P(6 losses in a row in 100 trades) at a 55% win rate  |
| 3     | Trudno       | Strong STEM / econometrics | Derive the Kelly fraction; test whether a backtest Sharpe is significant |
| 4     | Ekstremalnie | Graduate                   | Itô's lemma on GBM; Fourier transform of a price series                  |
| 5     | Quant Trader | Interview-ready            | Market-making games, brainteasers, open "how would you model X"          |

A lesson's level is the level of its hardest _required_ idea. Exercises span the lesson's level ±1, plus one interview-style item (the brief computes the mix).

## 5. Exercises

One YAML file per exercise: `content/exercises/<track>/<lesson-id>/<exercise-id>.yaml`. Schema: `src/features/exercises/schema.ts` (the build rejects anything else, with `file: field: reason`).

Common fields: `id`, `type`, `level`, `topics`, `lessonIds`, `prompt` (`pl`, optional `en`, math allowed), `params`, `hints` (ordered, at least one), `solution` (step by step), `estimatedMinutes`, `source` (if adapted), `status`.

### Numeric (also `estimation`, `interactive`)

```yaml
id: kelly-even-money
type: numeric
level: 3
topics: [kelly, bet-sizing]
lessonIds: [kelly-criterion]
prompt:
  pl: "Zakład płaci 1 do 1, a szansa wygranej to $p = {p}$. Jaką część kapitału stawia kryterium Kelly'ego?"
params: { p: 0.6 }
answer: 0.2
tolerance: 0.001
hints:
  - pl: "Kelly dla zakładu 1:1 to $f^* = p - q$."
solution:
  pl: "$q = 1 - p = 0{,}4$, więc $f^* = 0{,}6 - 0{,}4 = 0{,}2$."
estimatedMinutes: 3
status: draft
verify: |
  q = 1 - p
  result = p - q
```

Math in YAML: wrap text that contains a backslash (`\cdot`, `\frac`) in **single quotes** or a `|` block. In double quotes, YAML reads `\c` as an escape and the build fails.

`verify` is **required** for `numeric`, `estimation`, `interactive` and `symbolic`. It receives `params` as variables and must assign `result`. `pnpm content:verify` runs it with real Python and compares it with `answer` within `tolerance`. Simulations must set `seed` in `params` and call `random.seed(seed)` (the check fails otherwise).

**Variants** ("similar exercise"): list further versions with their own params and answer. Each one is checked by `content:verify`, and the learner moves through them with "Podobne zadanie" (N).

```yaml
params: { p: 0.6 }
answer: 0.2
variants:
  - { params: { p: 0.55 }, answer: 0.1 }
  - { params: { p: 0.7 }, answer: 0.4 }
```

Prompt placeholders `{p}` are filled per variant, locale-formatted (Polish decimal comma; inside math as `0{,}6`).

**Tolerance and units.** `tolerance` is absolute; add `relTolerance: 0.01` to also accept answers within 1% of the answer (either passing is enough). `unit` says how a typed `%` reads:

- `fraction` (default): `25%`, `0,25` and `1/4` are all 0.25. Store the answer as a fraction.
- `percent`: the answer is stored in percent (`25`); `25`, `25%` and `0,25` all count.
- `number`: a `%` is refused with a message (the answer is not a share).

Estimation (Fermi) answers score by bands: within 2× of the answer is full marks, within 10× is half, anything further (or of the wrong sign) is 0. Ordering scores the share of item pairs in the right relative order (Kendall).

**Common mistakes.** List typical wrong answers with targeted feedback. `answer` is a number or an expression of the params (so it works with random params). `content:verify` fails if a mistake equals the correct answer for any version.

```yaml
mistakes:
  - answer: "k * r / 100"
    feedback: { pl: "To sam wzrost. Dodaj go do kwoty początkowej." }
```

**Random params** (instead of `variants`, never both): each learner gets their own numbers. Give each param a range or a list and a `formula` that computes the answer in our expression language (`+ - * / ^`, `sqrt`, `ln`, `exp`…). The formula is the TypeScript twin of `verify`: `content:verify` checks they agree on 100 seeds and names the first seed that doesn't. `params` and `answer` stay as the base version.

```yaml
params: { k: 200, r: 5 }
answer: 210
random:
  params:
    k: { min: 100, max: 1000, step: 50 }
    r: { choices: [2, 5, 10, 20] }
  formula: "k * (1 + r / 100)"
verify: |
  result = k * (1 + r / 100)
```

The seed is the learner (a random `qla_sid` cookie) + the exercise + the attempt number (`?n=`); "Podobne zadanie" is the next attempt. The server regenerates the numbers from the seed when grading.

### Symbolic

`answer: "2*x"`, and `verify` assigns the expression string; the comparison ignores spacing and case and treats `**` as `^`.

### Choice, multi-select, ordering

```yaml
type: choice # or multi (answer: [a, c]) or ordering (answer lists every option)
options:
  - { id: a, pl: "Rośnie" }
  - { id: b, pl: "Nie zmienia się" }
answer: b
```

### Code, open, brainteaser

- `code`: `starter` and hidden Python `tests` (run in the browser sandbox from Phase 12).
- `open`: `rubric` (what a good answer contains), graded by AI from Phase 10.
- `brainteaser`: `rubric`, optional `answer` and `followUp`.

Writing rules: one skill per exercise; realistic numbers; the prompt never gives away the method; hints go from a nudge to almost the answer; the solution shows every step.

## 6. GuruMyth

```mdx
<GuruMyth claim="90% skuteczności oznacza pewny zysk." debunk="win-rate-myth">
Skuteczność mówi, jak często wygrywasz, a nie ile. Przy 90% wygranych po 1 zł i 10% przegranych
po 15 zł wartość oczekiwana wynosi $0{,}9 \cdot 1 - 0{,}1 \cdot 15 = -0{,}6$ zł na transakcję.
</GuruMyth>
```

- The claim is generic and sounds plausible: the way people actually say it.
- The body proves it wrong with numbers, then says what is true instead.
- `debunk` names the matching Debunk Lab entry (Phase 16).

## 7. Citations

`sources` in the frontmatter: `book` as "Author, Title" (edition if it matters), `chapter`, `page`. Exercises adapted from a book carry `source` the same way. Video links go in `relatedVideos` (title + URL).

## 8. Workflow

1. Drop notes into `content/_inbox/<topic>.md` with front matter:
   ```yaml
   ---
   lesson: kelly-criterion
   sources:
     - book: "Author, Title"
       chapter: "4"
   ---
   ```
2. `pnpm content:draft content/_inbox/<topic>.md` writes `<topic>.brief.md`: where the files go, the copyright rule, the exercise mix and your notes. Paste it into a Claude Code session.
3. Write the lesson and exercises with `status: draft`. Loop until clean:
   `pnpm content:build && pnpm content:verify && pnpm content:qa`
4. Read it in the internal preview: `/pl/dev/content-preview?id=<lesson-id>` (drafts are visible there only).
5. Review against the checklist, then set `status: review`, and `published` once approved. Only `published` lessons show their body on public pages.
6. `pnpm content:status` lists every lesson and exercise with its state.

## 9. Review checklist

- [ ] Facts and numbers are correct; every computed answer has a passing `verify`.
- [ ] Our own words throughout; sources cited; at most one-sentence quotes.
- [ ] Voice: short sentences, no hype, myths phrased generically.
- [ ] Intuition → definition → example → formal result; depth variants differ where it helps.
- [ ] Every exercise: hint(s), full solution, sensible level, no answer printed in the lesson.
- [ ] Math renders; equations referenced with `<EqRef>` exist; margin notes are asides.
- [ ] Polish reads naturally; the English translation matches (same `id`).
- [ ] `content:build`, `content:verify`, `content:qa` pass; the preview looks right on a phone.

## 10. Commands

| Command                            | What it does                                                              |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `pnpm content:build`               | Validate and compile lessons, glossary and exercises (fails on any error) |
| `pnpm content:verify [--root dir]` | Run every exercise's Python `verify` against its answer                   |
| `pnpm content:qa [--root dir]`     | Sources, hints, solutions, links, lesson references; level report         |
| `pnpm content:draft <note>`        | Turn an inbox note into a writing brief                                   |
| `pnpm content:status`              | Table of every lesson and exercise with its review state                  |
