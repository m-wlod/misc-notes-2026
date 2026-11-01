# Review: Phases 0–1

- **Date:** 2026-11-01
- **Reviewer:** an independent agent session that had not seen the code (report only, no edits).
- **Fixed on:** branch `fix/review-0-1`.
- **Status:** each item shows its outcome: ✅ fixed, ⏭ deferred (with the phase), ➖ won't fix (with the reason).

High findings H1 and H2 and low finding L1 were also reproduced by the author before fixing:

| Input     | Parsed as (before)  | Expected  |
| --------- | ------------------- | --------- |
| `1,000`   | 1                   | ambiguous |
| `1.000`   | 1                   | ambiguous |
| `2 3`     | 23                  | invalid   |
| `1 2 3,4` | 123.4               | invalid   |
| `2x103`   | 2000                | invalid   |
| `2·105`   | 200000              | invalid   |
| `3e-1`    | 0.30000000000000004 | 0.3       |

## High

- **H1 ✅ `parseLocaleNumber` guesses thousands separators.**
  - Before: `1,000` → 1, `1.000` → 1, `2 3` → 23, `1 2 3,4` → 123.4.
  - Fix: a single separator followed by exactly three digits after a 1–3 digit integer part with no leading zero is now `ambiguous`. Spaces are accepted only as valid groups of three.
- **H2 ✅ `×10` notation read digits as an exponent** (`2x103` → 2000). Fix: `^` is now required.

## Medium

- **M1 ✅ The reading column's `[&_p]:mb-[1em]` beat every `mb-*` utility on a paragraph** (specificity 0,1,1). Fix: a `.reading :where(p)` rule in `@layer components`, which utilities always override.
- **M2 ✅ Without a class-merge step, `w-full` beat `w-40`.** Fix: `cx` now uses `tailwind-merge`, configured for our theme scale, with tests.
- **M3 ✅ WalkChart axes didn't follow their inputs.**
  - Before: x ticks hardcoded to 0–250 with an off-by-one; a fixed y step; tick labels not locale-formatted; no tests.
  - Fix: tested `niceTicks()`, ticks derived from the data, locale formatter, `randomWalk({ points })`.
- **M4 ✅ Select highlight was 1.15:1.** Fix: a 2px `--focus` outline on the highlighted item.
- **M5 ✅ Dialog couldn't scroll on small screens.** Fix: `max-h` plus `overflow-y-auto`.
- **M6 ✅ Progress passed an unclamped value to Radix.** Fix: the value is clamped before it reaches Radix.
- **M7 ✅ NumberInput's invalid state was shown by colour only.** Fix: an `invalidMessage` prop renders a `FieldError` linked through `aria-describedby`.
- **M8 ✅ Callout `<aside>` created unlabelled landmarks; the style guide had no `<main>`.** Fix: `div role="note"`, a `<main>` landmark, and axe now runs the best-practice tags too.
- **M9 ✅ axe and the focus test only saw the page as first loaded.** Fix: e2e opens the Dialog (axe plus focus trap), the Select (visible highlight) and the Popover (axe). The focus test now also checks the outline colour.
- **M10 ✅ No component tests; jsdom used for pure tests.** Fix: Testing Library tests for NumberInput, Progress, DataRule and Callout. Pure tests run in `node`; component tests opt into jsdom per file.
- **M11 ✅ `/styleguide` gate was decided at build time.** Fix: a runtime check in `proxy.ts` (404) plus a request-time server gate. Allowed in development, on Vercel previews, or with `ENABLE_STYLEGUIDE=1`; never when `VERCEL_ENV=production`. The decision function is unit-tested.
- **M12 ✅ Accent used for decoration.** Fix: the myth callout and the "Nowe" badge are neutral, margin-note markers are muted ink, and `−0,1%` uses `text-data-down`.

## Low

- **L1 ✅** `3e-1` → 0.30000000000000004 and `1e-400` → 0. Fix: the value is built with `Number("…e…")`, and underflow to 0 is rejected.
- **L2 ✅** `--blur-*` and `--animate-*` (bounce, spin, ping) were still in the theme, and arbitrary shadow, radius and colour values compiled. Fix: those theme groups are reset (only `pulse` is redefined), and ESLint `no-restricted-syntax` blocks arbitrary `shadow-[`, `rounded-[`, colour `[#…]` and `text-[`.
- **L3 ✅** MarginNote was read twice by screen readers. Fix: the markers are `aria-hidden` and the note gets a localised screen-reader prefix. ⏭ Overlap between notes that sit close together is deferred to the Phase 6 reader layout.
- **L4 ✅** `db:types` target folder was untracked. Fix: `src/lib/db/README.md`.
- **L5 ✅** Coverage was configured without its provider. Fix: the config is removed until Phase 20 sets coverage targets.
- **L6 ✅** `metadataBase` silently fell back to localhost. Fix: `siteUrl()` uses `NEXT_PUBLIC_SITE_URL`, then `VERCEL_PROJECT_PRODUCTION_URL` or `VERCEL_URL`, then localhost, and is tested.
- **L7 ✅** Style guide was missing tokens. Fix: it now shows all colour tokens plus radii, motion, layers and spacing.
- **L8 ✅** Off-scale type sizes. Fix: a `text-2xs` (11px) token for chart and meta text; the other arbitrary sizes are removed.
- **L9 ✅** Duplication. Fix: a shared `linearScale`, font stacks defined once as tokens, a shared `icons.tsx`, `cx` in MarginNote, and the e2e test imports the theme storage key.
- **L10 ✅** Scroll containers couldn't take focus, the toast viewport had `outline-none`, and the radio group was named twice. All fixed.
- **L11 ✅** The chart's accessible label was typed by hand. Fix: it's computed from the data.
- **L12 ✅** Vitest globals were in the app's types, and the demo shadowed `describe`. Fix: tests import from `vitest`. CI only cancels superseded runs on PRs, not on `main`.

## Found by the new tests while fixing

The overlay and focus-colour e2e tests added for M9 caught two more real issues. Both are fixed.

- **Popover content had no accessible name.** Radix renders it as `role="dialog"`, and axe flagged `aria-dialog-name`. Fix: `PopoverContent` now requires a `label`.
- **Focus rings faded in from the text colour.** `transition-colors` also animates `outline-color`, so for 150ms a link's focus ring showed in `accent-text` instead of `--focus`. Fix: Link and Tabs name the properties they transition, and `outline-color` is never among them. The Select highlight also needed `outline-solid` alongside `outline-2`, because `outline-none` leaves `--tw-outline-style: none` set.

## What the reviewer said not to rework

The token setup and contrast test, the removed default palette, the split env schema, CI permissions, the Radix usage, the ThemeSwitch mount guard, the no-flash and latin-ext font tests, the global reduced-motion rule, and the RNG / Box–Muller code.
