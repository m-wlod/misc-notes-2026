// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataRule } from "./data";
import { MarginNote } from "./margin-note";
import { WalkChart } from "./walk-chart";

const fmt = (v: number) => new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(v);

describe("DataRule", () => {
  it("is a plain separator with fewer than two values", () => {
    const { container } = render(<DataRule values={[1]} />);
    expect(container.querySelector("hr")).not.toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("is an image only when labelled, and keeps the sparkline inside its viewBox", () => {
    render(<DataRule values={[5, 1, 9, 3]} label="Linia" />);
    const img = screen.getByRole("img", { name: "Linia" });
    const ys = [
      ...(img.querySelector("path")?.getAttribute("d") ?? "").matchAll(/[ML][\d.]+ ([\d.]+)/g),
    ].map((m) => Number(m[1]));
    expect(ys).toHaveLength(4);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...ys)).toBeLessThanOrEqual(18);
  });

  it("is a decorative separator without a label", () => {
    render(<DataRule values={[1, 2, 3]} />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("WalkChart", () => {
  it("derives the accessible label from the data (review L11)", () => {
    render(
      <WalkChart
        seed={7}
        days={250}
        format={fmt}
        describe={(s) =>
          `${String(s.days)} dni, koniec ${fmt(s.end)}, min ${fmt(s.min)}, max ${fmt(s.max)}`
        }
      />,
    );
    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-label")).toMatch(
      /^250 dni, koniec \d+(,\d)?, min \d+(,\d)?, max \d+(,\d)?$/,
    );
  });

  it("labels the x axis from the real number of days, with no off-by-one (review M3)", () => {
    const { container } = render(
      <WalkChart seed={1} days={100} format={fmt} describe={() => "x"} />,
    );
    const desktop = container.querySelectorAll("svg")[0];
    const labels = [...(desktop?.querySelectorAll("text") ?? [])].map((t) => t.textContent);
    expect(labels).toContain("100");
    expect(labels).not.toContain("250");
  });

  it("keeps the y labels readable for volatile paths (review M3: no label pile-up)", () => {
    const { container } = render(
      <WalkChart seed={2} days={250} sigma={0.05} format={fmt} describe={() => "x"} />,
    );
    const desktop = container.querySelectorAll("svg")[0];
    const gridLines = desktop?.querySelectorAll("line.stroke-grid").length ?? 0;
    expect(gridLines).toBeGreaterThanOrEqual(3);
    expect(gridLines).toBeLessThanOrEqual(8);
  });
});

describe("MarginNote", () => {
  it("announces the note once with a prefix and hides the visual markers (review L3)", () => {
    render(
      <p>
        Tekst.
        <MarginNote n={1} srLabel="Przypis">
          Treść przypisu.
        </MarginNote>
      </p>,
    );
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Przypis 1: 1Treść przypisu.");
    for (const sup of document.querySelectorAll("sup"))
      expect(sup).toHaveAttribute("aria-hidden", "true");
  });
});
