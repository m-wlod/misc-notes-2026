/** `pnpm content:status`: what exists and in which state (stand-in for /admin/content). */
export type StatusRow = {
  kind: "lesson" | "exercise";
  id: string;
  status: string;
  level: number | string;
  detail: string;
};

export function statusTable(rows: readonly StatusRow[]): string {
  const header: StatusRow = {
    kind: "lesson",
    id: "id",
    status: "status",
    level: "level",
    detail: "detail",
  };
  const all = [header, ...rows];
  const w = (k: keyof StatusRow) => Math.max(...all.map((r) => String(r[k]).length));
  const line = (r: StatusRow) =>
    [
      (r === header ? "kind" : r.kind).padEnd(8),
      r.id.padEnd(w("id")),
      r.status.padEnd(w("status")),
      String(r.level).padEnd(w("level")),
      r.detail,
    ].join("  ");
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const key = `${r.kind} ${r.status}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return [
    line(header),
    ...rows.map(line),
    "",
    Object.entries(counts)
      .map(([k, n]) => `${k}: ${String(n)}`)
      .join(" · "),
  ].join("\n");
}
