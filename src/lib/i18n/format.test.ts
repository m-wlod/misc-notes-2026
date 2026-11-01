import { describe, expect, it } from "vitest";

import { formatCurrency, formatDate, formatNumber, formatPercent } from "./format";

// Intl uses NBSP (U+00A0) or narrow NBSP (U+202F) as separators; normalise for readable assertions.
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("format (pl)", () => {
  it("uses a decimal comma and groups 5+ digit numbers with a space", () => {
    expect(plain(formatNumber("pl", 0.25))).toBe("0,25");
    expect(plain(formatNumber("pl", 12400))).toBe("12 400");
    expect(plain(formatNumber("pl", 1240.5))).toBe("1240,5"); // Polish norm: 4 digits ungrouped
  });

  it("formats percentages, currencies and dates the Polish way", () => {
    expect(plain(formatPercent("pl", 0.25))).toBe("25%");
    expect(plain(formatPercent("pl", -0.001))).toBe("-0,1%");
    expect(plain(formatCurrency("pl", 1240.5, "PLN"))).toBe("1240,50 zł");
    expect(plain(formatCurrency("pl", 12400, "USD"))).toBe("12 400,00 USD");
    expect(plain(formatDate("pl", new Date("2026-11-01T12:00:00Z")))).toBe("1 lis 2026");
  });
});

describe("format (en)", () => {
  it("uses a decimal point and comma grouping", () => {
    expect(formatNumber("en", 12400.5)).toBe("12,400.5");
    expect(formatPercent("en", 0.125)).toBe("12.5%");
    expect(plain(formatCurrency("en", 1240.5, "PLN"))).toBe("PLN 1,240.50");
    expect(formatCurrency("en", 12400, "USD")).toBe("US$12,400.00");
    expect(plain(formatDate("en", new Date("2026-11-01T12:00:00Z")))).toBe("1 Nov 2026");
  });

  it("formats dates in Warsaw time, not UTC", () => {
    // 23:30 UTC on 31 Oct is already 1 Nov in Warsaw (UTC+1 after the October DST change)
    expect(plain(formatDate("en", new Date("2026-10-31T23:30:00Z")))).toBe("1 Nov 2026");
  });
});
