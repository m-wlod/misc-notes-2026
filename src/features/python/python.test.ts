import { describe, expect, it } from "vitest";

import {
  addCell,
  defaultNotebook,
  fromPy,
  MAX_CELLS,
  moveCell,
  newCellId,
  parseNotebook,
  removeCell,
  setCode,
  toPy,
} from "./notebook-store";
import { cleanPlot, histogram, MAX_POINTS, thin } from "./plot";
import {
  emptyOutput,
  MAX_PLOTS,
  MAX_STREAM_CHARS,
  reduceOutput,
  usesMatplotlib,
  type OutputEvent,
  type RawPlot,
  type RunOutput,
} from "./protocol";
import { exceptionLine, outcomeOf, readValue } from "./run-tests";

const run = (events: OutputEvent[]) => events.reduce(reduceOutput, emptyOutput());
const plot = (y: number[], x: number[] | null = null, kind: RawPlot["kind"] = "line"): RawPlot => ({
  kind,
  label: null,
  x: x ? Float64Array.from(x) : null,
  y: Float64Array.from(y),
  bins: 4,
  xDates: false,
});

describe("run output reducer", () => {
  it("merges consecutive chunks of the same stream and keeps the order", () => {
    const out = run([
      { type: "status", status: "running" },
      { type: "stdout", id: 1, text: "a" },
      { type: "stdout", id: 1, text: "b\n" },
      { type: "stderr", id: 1, text: "warn\n" },
      { type: "stdout", id: 1, text: "c" },
      { type: "done", id: 1, value: "42", error: null, ms: 12 },
    ]);
    expect(out.stream).toEqual([
      { kind: "out", text: "ab\n" },
      { kind: "err", text: "warn\n" },
      { kind: "out", text: "c" },
    ]);
    expect(out).toMatchObject({ status: "done", value: "42", ms: 12 });
  });

  it("marks errors, refusals, stops and crashes", () => {
    expect(
      run([{ type: "done", id: 1, value: null, error: "ZeroDivisionError", ms: 1 }]).status,
    ).toBe("error");
    expect(run([{ type: "refused", id: 1, reason: "matplotlib" }])).toMatchObject({
      status: "error",
      refused: "matplotlib",
    });
    expect(run([{ type: "stopped", why: "timeout" }])).toMatchObject({
      status: "stopped",
      stopped: "timeout",
    });
    expect(run([{ type: "crash", message: "offline" }])).toMatchObject({
      status: "error",
      error: "offline",
    });
  });

  it("caps printed output and the number of plots", () => {
    const big = "x".repeat(MAX_STREAM_CHARS - 10);
    const out = run([
      { type: "stdout", id: 1, text: big },
      { type: "stderr", id: 1, text: "y".repeat(50) },
      { type: "stdout", id: 1, text: "more" },
    ]);
    expect(out.stream.reduce((n, c) => n + c.text.length, 0)).toBe(MAX_STREAM_CHARS);
    const plots = run(
      Array.from(
        { length: MAX_PLOTS + 3 },
        () => ({ type: "plot", id: 1, plot: plot([1]) }) as const,
      ),
    );
    expect(plots.plots).toHaveLength(MAX_PLOTS);
  });

  it("spots matplotlib imports, not mentions", () => {
    expect(usesMatplotlib("import matplotlib.pyplot as plt")).toBe(true);
    expect(usesMatplotlib("x = 1\nfrom matplotlib import pyplot")).toBe(true);
    expect(usesMatplotlib("# no matplotlib here\nprint('matplotlib')")).toBe(false);
  });
});

describe("plot payloads", () => {
  it("drops non-finite pairs and counts them", () => {
    const p = cleanPlot(plot([1, NaN, 3, Infinity, 5]));
    expect(p.kind === "line" && p.points).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
    expect(p.dropped).toBe(2);
  });

  it("uses x when given, up to the shorter length", () => {
    const p = cleanPlot(plot([10, 20, 30], [0.5, 1.5]));
    expect(p.kind === "line" && p.points).toEqual([
      [0.5, 10],
      [1.5, 20],
    ]);
  });

  it("thins long lines but keeps spikes and both ends", () => {
    const n = 100_000;
    const pts = Array.from(
      { length: n },
      (_, i) => [i, i === 54_321 ? 1000 : Math.sin(i)] as [number, number],
    );
    const out = thin(pts);
    expect(out.length).toBeLessThanOrEqual(MAX_POINTS + 1);
    expect(out[0]).toEqual(pts[0]);
    expect(out.at(-1)).toEqual(pts.at(-1));
    expect(out.some((p) => p[1] === 1000)).toBe(true);
    expect(cleanPlot(plot(pts.map((p) => p[1]))).thinned).toBe(true);
  });

  it("bins a histogram with every value counted once", () => {
    const bins = histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 10], 5);
    expect(bins).toHaveLength(5);
    expect(bins.reduce((n, b) => n + b.count, 0)).toBe(10);
    expect(bins[0]?.from).toBe(0);
    expect(bins.at(-1)?.to).toBe(10);
    expect(histogram([3, 3, 3], 10).reduce((n, b) => n + b.count, 0)).toBe(3);
    expect(histogram([], 10)).toEqual([]);
    const h = cleanPlot(plot([1, 2, NaN, 3], null, "hist"));
    expect(h.kind === "hist" && h.n).toBe(3);
    expect(h.dropped).toBe(1);
  });
});

describe("notebook store", () => {
  const start = defaultNotebook(["a = 1", "a + 1"]);

  it("round-trips through storage and falls back on bad data", () => {
    expect(parseNotebook(JSON.stringify(start), start)).toEqual(start);
    expect(parseNotebook(null, start)).toBe(start);
    expect(parseNotebook("{nope", start)).toBe(start);
    expect(parseNotebook(JSON.stringify({ version: 2, cells: [] }), start)).toBe(start);
    expect(parseNotebook(JSON.stringify({ version: 1, cells: [] }), start)).toBe(start);
  });

  it("adds, moves, edits and removes cells", () => {
    let nb = addCell(start, "start-0", "c-x", "b = 2");
    expect(nb.cells.map((c) => c.id)).toEqual(["start-0", "c-x", "start-1"]);
    nb = moveCell(nb, "c-x", -1);
    expect(nb.cells[0]?.id).toBe("c-x");
    expect(moveCell(nb, "c-x", -1)).toBe(nb);
    nb = setCode(nb, "c-x", "b = 3");
    expect(nb.cells[0]?.code).toBe("b = 3");
    nb = removeCell(nb, "c-x");
    expect(nb.cells).toHaveLength(2);
    const one = removeCell(removeCell(nb, "start-0"), "start-1");
    expect(one.cells).toHaveLength(1);
    expect(one.cells[0]?.code).toBe("");
  });

  it("caps the number of cells", () => {
    let nb = start;
    for (let i = 0; i < MAX_CELLS + 5; i++) nb = addCell(nb, null, `c-${String(i)}`);
    expect(nb.cells).toHaveLength(MAX_CELLS);
  });

  it("makes ids the schema accepts", () => {
    const id = newCellId();
    expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  it("exports to # %% cells and imports them back", () => {
    let i = 0;
    const ids = () => `c-${String(i++)}`;
    const back = fromPy(toPy(start), ids);
    expect(back?.cells.map((c) => c.code)).toEqual(["a = 1", "a + 1"]);
    // A plain script is one cell; a title after %% and code before the first marker are kept.
    expect(fromPy("x = 1\nprint(x)\n", ids)?.cells.map((c) => c.code)).toEqual(["x = 1\nprint(x)"]);
    expect(fromPy("import numpy\n# %% Data\ny = 2\r\n", ids)?.cells.map((c) => c.code)).toEqual([
      "import numpy",
      "y = 2",
    ]);
    expect(
      fromPy(Array.from({ length: MAX_CELLS + 1 }, () => "# %%\nx").join("\n"), ids),
    ).toBeNull();
  });
});

describe("code exercise test outcomes", () => {
  const out = (o: Partial<RunOutput>): RunOutput => ({ ...emptyOutput("done"), ...o });

  it("passes a clean run, fails an assert without detail, shows a crash's exception", () => {
    expect(outcomeOf(out({}), "m")).toEqual({
      passed: true,
      message: "m",
      detail: null,
      timedOut: false,
    });
    const assertFail = out({
      status: "error",
      error: 'Traceback (most recent call last):\n  File "<cell>", line 9\nAssertionError\n',
    });
    expect(outcomeOf(assertFail, "m")).toMatchObject({ passed: false, detail: null });
    const crash = out({
      status: "error",
      error: "Traceback …\nNameError: name 'df' is not defined\n",
    });
    expect(outcomeOf(crash, "m")).toMatchObject({
      passed: false,
      detail: "NameError: name 'df' is not defined",
    });
    expect(outcomeOf(out({ status: "stopped", stopped: "timeout" }), "m")).toMatchObject({
      passed: false,
      timedOut: true,
      detail: null,
    });
  });

  it("reads the computed number from float()'s repr", () => {
    expect(readValue("0.0007553732608239094")).toBe(0.0007553732608239094);
    expect(readValue("1e-05")).toBe(1e-5);
    expect(readValue("nan")).toBeNull();
    expect(readValue(null)).toBeNull();
    expect(exceptionLine("a\nb\n\nKeyError: 'close'\n")).toBe("KeyError: 'close'");
  });
});
