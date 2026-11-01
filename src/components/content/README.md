# MDX content components

Lesson building blocks used in `content/<locale>/tracks/**/*.mdx`. They're implemented in `blocks.tsx` and wired up in `src/features/content/mdx-content.tsx`. Labels come from `messages/<locale>/content.json`.

| Component                                          | Use                                                          | Notes                                                        |
| -------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `<Intuition>`                                      | The plain-language idea first                                | Accent rule, italic                                          |
| `<Definition title="…">`                           | A formal definition                                          | `title` optional                                             |
| `<Theorem title="…">`                              | A result                                                     | `title` optional                                             |
| `<Proof>`                                          | A proof                                                      | Collapsed `<details>`; ends with ∎                           |
| `<Example title="…">`                              | A worked example                                             |                                                              |
| `<GuruMyth claim="…" debunk="id">`                 | A generic false claim; the children are the math showing why | Links to the Debunk Lab (entry links from Phase 16)          |
| `<Sidenote>`                                       | Margin note, placed right after the word it annotates        | Numbered automatically                                       |
| `<Figure caption="…" meta="…">`                    | Numbered figure                                              | Numbered automatically; e.g. wraps `<RandomWalk seed={7} />` |
| `<Simulation id="…" caption="…" />`                | Embedded simulation                                          | Placeholder until Phase 11                                   |
| `<PythonCell>` with a fenced `python` block inside | Runnable example                                             | Highlighted now, runnable from Phase 12                      |
| `<ExerciseRef id="…" title="…" />`                 | Link to a practice exercise                                  | Ids validated from Phase 8                                   |
| `<InterviewTip>`                                   | How this comes up in quant interviews                        |                                                              |
| `<KeyFormula>` with `$$…$$` inside                 | The one formula to remember                                  | The equation is numbered like the others                     |
| `<Depth level="easy\|formal">`, `<Term id="…">`    | Depth toggle, glossary hover card                            | Phase 4b                                                     |

## Math and numbering

- Inline: `$p_i$`. Display: `$$ … $$` on their own lines. Polish decimals inside math: `0{,}52`.
- Display equations are numbered (1), (2), … per lesson. Name one with `\label{name}` inside the TeX, then refer to it in text with `<EqRef to="name" />`. An unknown or duplicate label fails the build.
- Don't put `{…}` in plain text: MDX reads braces as code. Inside `$…$` they're fine.

## Rules the build enforces (`pnpm content:build`)

- The frontmatter schema is in `velite.config.ts` (CLAUDE.md "Content model"); unknown fields are errors.
- Ids are unique per locale. Prerequisites and glossary terms must exist. There are no prerequisite cycles. A translation needs a Polish original with the same `id`. The file's folder (`pl/` or `en/`) must match its `locale`.
- Every error prints as `file: field: reason`. See `src/features/content/build-errors.test.ts`.
- Prettier skips `.mdx` (it breaks math and code inside components), so keep lines readable by hand.
