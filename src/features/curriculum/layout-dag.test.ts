import { describe, expect, it } from "vitest";

import { countCrossings, layoutDag, type DagInput } from "./layout-dag";

const graph: DagInput[] = [
  { id: "a", prerequisites: [] },
  { id: "b", prerequisites: [] },
  { id: "c", prerequisites: ["b"] },
  { id: "d", prerequisites: ["a"] },
  { id: "e", prerequisites: ["c", "d"] },
  { id: "f", prerequisites: ["a", "e"] },
];

describe("layoutDag", () => {
  it("puts every lesson below all its prerequisites (longest path)", () => {
    const layout = layoutDag(graph);
    const at = new Map(layout.nodes.map((n) => [n.id, n]));
    for (const e of layout.edges) {
      expect(at.get(e.to)?.layer).toBeGreaterThan(at.get(e.from)?.layer ?? Infinity);
      expect(at.get(e.to)?.y).toBeGreaterThan(at.get(e.from)?.y ?? Infinity);
    }
    expect(at.get("f")?.layer).toBe(3); // a/b → c/d → e → f
  });

  it("keeps every node and edge, inside the canvas, with no overlaps", () => {
    const layout = layoutDag(graph);
    expect(layout.nodes.map((n) => n.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(layout.edges).toHaveLength(6);
    const spots = new Set(layout.nodes.map((n) => `${String(n.x)},${String(n.y)}`));
    expect(spots.size).toBe(layout.nodes.length);
    for (const n of layout.nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(layout.width);
      expect(n.y).toBeLessThan(layout.height);
    }
  });

  it("is deterministic and orders layers to avoid crossings", () => {
    expect(layoutDag(graph)).toEqual(layoutDag(graph));
    // Crossed on input order (b's child listed before a's); the sweeps untangle it.
    expect(countCrossings(layoutDag(graph))).toBe(0);
  });

  it("ignores prerequisites outside the graph", () => {
    const layout = layoutDag([{ id: "x", prerequisites: ["elsewhere"] }]);
    expect(layout.nodes[0]?.layer).toBe(0);
    expect(layout.edges).toEqual([]);
  });
});
