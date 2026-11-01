// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Callout, clampProgress, Progress, Table } from "./display";

describe("clampProgress", () => {
  it.each([
    [38, 100, 38],
    [-5, 100, 0],
    [150, 100, 100],
    [Number.NaN, 100, 0],
    [5, 0, 0],
  ])("clampProgress(%d, %d) = %d", (v, max, expected) => {
    expect(clampProgress(v, max)).toBe(expected);
  });
});

describe("Progress", () => {
  it("passes a clamped value to Radix so aria-valuenow survives (review M6)", () => {
    render(<Progress value={150} aria-label="Postęp" />);
    const bar = screen.getByRole("progressbar", { name: "Postęp" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("reports in-range values unchanged", () => {
    render(<Progress value={38} aria-label="Postęp" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "38");
  });
});

describe("Callout", () => {
  it("is a note, not a complementary landmark (review M8)", () => {
    render(<Callout label="Mit">Treść</Callout>);
    expect(screen.getByRole("note")).toHaveTextContent("MitTreść");
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});

describe("Table", () => {
  it("wraps the table in a named, keyboard-focusable scroll region (review L10)", () => {
    render(
      <Table label="Statystyki" caption="Statystyki zadań">
        <tbody>
          <tr>
            <td>1</td>
          </tr>
        </tbody>
      </Table>,
    );
    const region = screen.getByRole("region", { name: "Statystyki" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("table", { name: "Statystyki zadań" })).toBeInTheDocument();
  });
});
