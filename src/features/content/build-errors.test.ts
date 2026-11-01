import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

/**
 * "Invalid content fails the build with a readable error" (Phase 4 Done-when).
 * Builds each fixture in fixtures/invalid/ with the real Velite CLI, exactly as
 * `pnpm build` does (`velite build --strict`), into a temp folder.
 */

const FIXTURES = "src/features/content/fixtures/invalid";
const out = mkdtempSync(join(tmpdir(), "qla-content-"));
afterAll(() => {
  rmSync(out, { recursive: true, force: true });
});

function build(fixture: string) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/velite/bin/velite.js", "build", "--strict"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        CONTENT_ROOT: `${FIXTURES}/${fixture}`,
        CONTENT_OUT: join(out, fixture),
        NO_COLOR: "1",
        FORCE_COLOR: "0",
      },
    },
  );
  // Strip ANSI colours in case the CLI ignores NO_COLOR.
  const output = `${result.stdout}${result.stderr}`.replaceAll(/\x1b\[[0-9;]*m/g, "");
  return { status: result.status, output };
}

const file = (fixture: string, name = "a") => `${FIXTURES}/${fixture}/pl/tracks/t/${name}.mdx`;

describe("invalid content fails the build", { timeout: 60_000 }, () => {
  it.each([
    ["bad-frontmatter", [file("bad-frontmatter"), "less than or equal to 5", "level", "summary"]],
    ["duplicate-id", [`${file("duplicate-id", "b")}: id: "a" is already used by`]],
    [
      "broken-prerequisite",
      [`${file("broken-prerequisite")}: prerequisites[0]: unknown lesson id "nie-ma-takiej"`],
    ],
    ["unknown-term", [`${file("unknown-term")}: <Term id="nieznany">: unknown glossary term`]],
    ["unknown-eqref", [file("unknown-eqref"), `<EqRef to="y" />: no equation is labelled "y"`]],
    [
      "curriculum-order",
      [`${FIXTURES}/curriculum-order/pl/tracks/t/m/a.mdx: prerequisites[0]: "b" comes later`],
    ],
  ])("%s", (fixture, expected) => {
    const { status, output } = build(fixture);
    expect(status, output).not.toBe(0);
    for (const text of expected) expect(output).toContain(text);
  });
});
