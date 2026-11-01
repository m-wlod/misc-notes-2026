/**
 * Layered layout for the prerequisite map (Sugiyama-style, small and deterministic):
 * 1. layer = 1 + the deepest prerequisite's layer, so every edge points downward;
 * 2. a few barycentre sweeps (down, then up) order each layer to reduce crossings;
 *    ties keep curriculum order;
 * 3. each layer is centred horizontally.
 * Pure, so the properties are unit-tested. About 70 nodes need nothing heavier.
 */

export type DagInput = { id: string; prerequisites: readonly string[] };
export type PlacedNode = { id: string; layer: number; x: number; y: number };
export type DagLayout = {
  nodes: PlacedNode[];
  edges: { from: string; to: string }[];
  width: number;
  height: number;
};

const SWEEPS = 4;

export function layoutDag(
  input: readonly DagInput[],
  { colWidth = 150, rowHeight = 110, padding = 60 } = {},
): DagLayout {
  const order = new Map(input.map((n, i) => [n.id, i]));
  const known = (id: string) => order.has(id);
  const parents = new Map(input.map((n) => [n.id, n.prerequisites.filter(known)]));
  const children = new Map<string, string[]>(input.map((n) => [n.id, []]));
  for (const n of input) for (const p of parents.get(n.id) ?? []) children.get(p)?.push(n.id);

  // 1. Layers by longest path. Input order lists prerequisites first; fall back to
  //    repeated relaxation if it doesn't.
  const layer = new Map<string, number>(input.map((n) => [n.id, 0]));
  for (let changed = true, guard = 0; changed && guard <= input.length; guard++) {
    changed = false;
    for (const n of input) {
      const want = Math.max(-1, ...(parents.get(n.id) ?? []).map((p) => layer.get(p) ?? 0)) + 1;
      if (want !== layer.get(n.id)) {
        layer.set(n.id, want);
        changed = true;
      }
    }
  }
  const depth = Math.max(0, ...layer.values()) + 1;
  const rows: string[][] = Array.from({ length: depth }, () => []);
  for (const n of input) rows[layer.get(n.id) ?? 0]?.push(n.id);

  // 2. Barycentre ordering.
  const position = new Map<string, number>();
  const index = () => {
    for (const row of rows) row.forEach((id, i) => position.set(id, i - (row.length - 1) / 2));
  };
  index();
  const reorder = (row: string[], neighbours: (id: string) => readonly string[]) => {
    const key = new Map(
      row.map((id) => {
        const ns = neighbours(id);
        const bary =
          ns.length === 0
            ? (position.get(id) ?? 0)
            : ns.reduce((sum, nb) => sum + (position.get(nb) ?? 0), 0) / ns.length;
        return [id, bary] as const;
      }),
    );
    row.sort(
      (a, b) => (key.get(a) ?? 0) - (key.get(b) ?? 0) || (order.get(a) ?? 0) - (order.get(b) ?? 0),
    );
  };
  for (let s = 0; s < SWEEPS; s++) {
    for (const row of rows.slice(1)) {
      reorder(row, (id) => parents.get(id) ?? []);
      index();
    }
    for (const row of rows.slice(0, -1).reverse()) {
      reorder(row, (id) => children.get(id) ?? []);
      index();
    }
  }

  // 3. Coordinates, each row centred.
  const widest = Math.max(1, ...rows.map((r) => r.length));
  const width = padding * 2 + (widest - 1) * colWidth;
  const nodes = rows.flatMap((row, l) =>
    row.map((id, i) => ({
      id,
      layer: l,
      x: padding + ((widest - row.length) / 2 + i) * colWidth,
      y: padding + l * rowHeight,
    })),
  );
  nodes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const edges = input.flatMap((n) => (parents.get(n.id) ?? []).map((p) => ({ from: p, to: n.id })));
  return { nodes, edges, width, height: padding * 2 + (depth - 1) * rowHeight };
}

/** Edge crossings between two consecutive-layer edge sets (for tests and tuning). */
export function countCrossings(layout: DagLayout): number {
  const at = new Map(layout.nodes.map((n) => [n.id, n]));
  const segs = layout.edges.flatMap((e) => {
    const a = at.get(e.from);
    const b = at.get(e.to);
    return a && b && b.layer === a.layer + 1 ? [{ a, b }] : [];
  });
  let crossings = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i];
      const t = segs[j];
      if (!s || !t || s.a.layer !== t.a.layer) continue;
      if ((s.a.x - t.a.x) * (s.b.x - t.b.x) < 0) crossings++;
    }
  }
  return crossings;
}
