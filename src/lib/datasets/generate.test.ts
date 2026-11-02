import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DATASET_IDS, generateDataset } from "./generate";

describe("sample datasets", () => {
  it("are deterministic", () => {
    for (const id of DATASET_IDS) expect(generateDataset(id)).toBe(generateDataset(id));
  });

  it("have a header, 750 weekday rows and positive prices", () => {
    const lines = generateDataset("ceny-gbm").trim().split("\n");
    expect(lines[0]).toBe("date,close");
    expect(lines).toHaveLength(751);
    for (const line of lines.slice(1)) {
      const [date, close] = line.split(",");
      const day = new Date(`${date ?? ""}T00:00:00Z`).getUTCDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
      expect(Number(close)).toBeGreaterThan(0);
    }
  });

  it("the regime dataset is calmer before day 400 than after", () => {
    const close = generateDataset("ceny-rezim")
      .trim()
      .split("\n")
      .slice(1)
      .map((l) => Number(l.split(",")[1]));
    const sd = (from: number, to: number) => {
      const r = close.slice(from + 1, to).map((c, i) => Math.log(c / (close[from + i] ?? c)));
      const m = r.reduce((a, b) => a + b, 0) / r.length;
      return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length);
    };
    expect(sd(400, 749) / sd(0, 399)).toBeGreaterThan(2);
  });

  it("match the files in public/datasets (run `pnpm datasets` after a change)", () => {
    for (const id of DATASET_IDS) {
      const file = readFileSync(path.join("public", "datasets", `${id}.csv`), "utf8");
      expect(file.replace(/\r\n/g, "\n")).toBe(generateDataset(id));
    }
  });
});
