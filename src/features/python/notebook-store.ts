import { z } from "zod/mini";

/**
 * The lab notebook kept in this browser (Phase 13) until accounts exist. Pure helpers on
 * the raw stored string, unit-tested without a DOM, plus `.py` export and import in the
 * `# %%` cell format that Jupyter, VS Code and Spyder all understand.
 */
export const NOTEBOOK_KEY = "qla:notebook:v1";
export const MAX_CELLS = 100;
export const MAX_CELL_CHARS = 50_000;

const cell = z.object({
  id: z.string().check(z.regex(/^[a-z0-9-]{1,40}$/)),
  code: z.string().check(z.maxLength(MAX_CELL_CHARS)),
});
export const notebookSchema = z.object({
  version: z.literal(1),
  cells: z.array(cell).check(z.minLength(1), z.maxLength(MAX_CELLS)),
});
export type Notebook = z.infer<typeof notebookSchema>;
export type Cell = Notebook["cells"][number];

/** The starting notebook: a tour of the helpers on synthetic data. */
export function defaultNotebook(starter: readonly string[]): Notebook {
  return { version: 1, cells: starter.map((code, i) => ({ id: `start-${String(i)}`, code })) };
}

export function parseNotebook(raw: string | null, fallback: Notebook): Notebook {
  if (!raw) return fallback;
  try {
    const parsed = notebookSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function newCellId(random: () => number = Math.random): string {
  return `c-${Math.floor(random() * 36 ** 8)
    .toString(36)
    .padStart(8, "0")}`;
}

export function addCell(nb: Notebook, afterId: string | null, id: string, code = ""): Notebook {
  if (nb.cells.length >= MAX_CELLS) return nb;
  const at = afterId === null ? nb.cells.length : nb.cells.findIndex((c) => c.id === afterId) + 1;
  const cells = [...nb.cells];
  cells.splice(at <= 0 ? cells.length : at, 0, { id, code });
  return { ...nb, cells };
}

export function removeCell(nb: Notebook, id: string): Notebook {
  if (nb.cells.length <= 1) return { ...nb, cells: [{ id: nb.cells[0]?.id ?? id, code: "" }] };
  return { ...nb, cells: nb.cells.filter((c) => c.id !== id) };
}

export function moveCell(nb: Notebook, id: string, by: -1 | 1): Notebook {
  const i = nb.cells.findIndex((c) => c.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= nb.cells.length) return nb;
  const cells = [...nb.cells];
  const [moved] = cells.splice(i, 1);
  if (moved) cells.splice(j, 0, moved);
  return { ...nb, cells };
}

export function setCode(nb: Notebook, id: string, code: string): Notebook {
  return {
    ...nb,
    cells: nb.cells.map((c) => (c.id === id ? { ...c, code: code.slice(0, MAX_CELL_CHARS) } : c)),
  };
}

/** `.py` with `# %%` separators: runs as a plain script, opens as cells in Jupyter/VS Code. */
export function toPy(nb: Notebook): string {
  return nb.cells.map((c) => `# %%\n${c.code.replace(/\s+$/, "")}\n`).join("\n");
}

/** Reads a `.py` file; `# %%` lines (with optional titles) split cells. */
export function fromPy(text: string, ids: () => string): Notebook | null {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const cells: string[][] = [];
  let currentCell: string[] | null = null;
  for (const line of lines) {
    if (/^#\s*%%/.test(line)) {
      currentCell = [];
      cells.push(currentCell);
      continue;
    }
    if (!currentCell) {
      currentCell = [];
      cells.push(currentCell);
    }
    currentCell.push(line);
  }
  const codes = cells
    .map((c) => c.join("\n").replace(/^\n+|\s+$/g, ""))
    .filter((c, i, all) => c.length > 0 || all.length === 1);
  if (codes.length === 0 || codes.length > MAX_CELLS) return null;
  if (codes.some((c) => c.length > MAX_CELL_CHARS)) return null;
  return { version: 1, cells: codes.map((code) => ({ id: ids(), code })) };
}
