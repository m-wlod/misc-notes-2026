import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "./achievements";
import { CATALOG_MIGRATION, catalogSql } from "./catalog-sql";
import { TIERS } from "./config";
import en from "../../../messages/en/gamification.json";
import pl from "../../../messages/pl/gamification.json";

describe("gamification catalog", () => {
  it("every achievement has a name and description in both languages, and nothing extra", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id).sort();
    expect(Object.keys(pl.achievements).sort()).toEqual(ids);
    expect(Object.keys(en.achievements).sort()).toEqual(ids);
  });

  it("every tier has a name", () => {
    expect(Object.keys(pl.tiers).sort()).toEqual(TIERS.map((t) => t.slug).sort());
  });

  it("the migration matches the code and messages (run `pnpm gamification:catalog`)", () => {
    expect(readFileSync(CATALOG_MIGRATION, "utf8").replace(/\r\n/g, "\n")).toBe(catalogSql());
  });

  it("escapes quotes for SQL", () => {
    expect(catalogSql()).toContain("Kelly''ego");
    expect(catalogSql()).toContain("Gambler''s ruin");
  });
});
