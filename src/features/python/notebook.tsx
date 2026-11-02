"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { store } from "@/features/reader/storage";

import { getRuntime } from "./client";
import type { EditorHandle } from "./code-editor";
import {
  addCell,
  defaultNotebook,
  fromPy,
  moveCell,
  newCellId,
  NOTEBOOK_KEY,
  parseNotebook,
  removeCell,
  setCode,
  toPy,
  type Notebook as NotebookState,
} from "./notebook-store";
import { OutputPanel } from "./output-panel";
import type { RunOutput } from "./protocol";
import { useRun, useRuntimeState } from "./use-run";

const CodeEditor = dynamic(() => import("./code-editor").then((m) => m.CodeEditor), {
  ssr: false,
});

type CellApi = {
  run: () => Promise<RunOutput>;
  clear: () => void;
  focus: () => void;
};

let lastRaw: string | null | undefined;
let lastValue: NotebookState | null = null;
let fallback: NotebookState | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(NOTEBOOK_KEY);
  } catch {
    return null;
  }
}
function read(): NotebookState | null {
  if (!fallback) return null;
  const raw = readRaw();
  if (raw === lastRaw && lastValue) return lastValue;
  lastRaw = raw;
  lastValue = parseNotebook(raw, fallback);
  return lastValue;
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
  };
}
const narrowQuery = "(max-width: 639px)";
function subscribeNarrow(onChange: () => void) {
  const mq = window.matchMedia(narrowQuery);
  mq.addEventListener("change", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
  };
}

/** The lab notebook (Phase 13): cells sharing one Python session, kept in this browser. */
export function Notebook({ starter }: { starter: string[] }) {
  const t = useTranslations("python");
  fallback ??= defaultNotebook(starter);
  const nb = useSyncExternalStore(subscribe, read, () => null);
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(narrowQuery).matches,
    () => false,
  );
  const runtime = useRuntimeState();
  const cells = useRef(new Map<string, CellApi>());
  const [runningAll, setRunningAll] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const update = useCallback((fn: (nb: NotebookState) => NotebookState) => {
    store(NOTEBOOK_KEY, (raw) =>
      JSON.stringify(fn(parseNotebook(raw, fallback ?? defaultNotebook([""])))),
    );
  }, []);

  if (!nb) return <p className="text-ink-muted">{t("notebook.loading")}</p>;

  const runAll = async () => {
    setRunningAll(true);
    for (const c of nb.cells) {
      const out = await cells.current.get(c.id)?.run();
      if (!out || out.status !== "done") break;
    }
    setRunningAll(false);
  };

  const restart = () => {
    getRuntime().restart();
    for (const api of cells.current.values()) api.clear();
  };

  const runAndNext = (id: string) => {
    void cells.current.get(id)?.run();
    const i = nb.cells.findIndex((c) => c.id === id);
    const next = nb.cells[i + 1];
    if (next) cells.current.get(next.id)?.focus();
    else update((n) => addCell(n, id, newCellId()));
  };

  const exportPy = () => {
    const blob = new Blob([toPy(nb)], { type: "text/x-python" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "notatnik.py";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importPy = async (file: File) => {
    const parsed = fromPy(await file.text(), () => newCellId());
    setImportError(!parsed);
    if (parsed) update(() => parsed);
  };

  return (
    <div data-notebook="">
      <div className="sticky top-0 z-(--z-sticky) -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b border-rule bg-bg px-4 py-2 sm:mx-0 sm:px-0">
        <Button type="button" size="sm" onClick={() => void runAll()} disabled={runningAll}>
          {t("notebook.runAll")}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={restart}>
          {t("notebook.restart")}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={exportPy}>
          {t("notebook.export")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => fileInput.current?.click()}
        >
          {t("notebook.import")}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".py,text/x-python,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importPy(f);
            e.target.value = "";
          }}
        />
        {confirmReset ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              // Fresh ids, so the editors start over with the starter code.
              const start = defaultNotebook(starter);
              update(() => ({
                ...start,
                cells: start.cells.map((c) => ({ ...c, id: newCellId() })),
              }));
              setConfirmReset(false);
              restart();
            }}
          >
            {t("notebook.resetConfirm")}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setConfirmReset(true);
            }}
          >
            {t("notebook.reset")}
          </Button>
        )}
        <p className="font-sans text-xs text-ink-muted" aria-live="polite">
          {runtime.phase === "loading"
            ? t("status.runtime")
            : runtime.phase === "ready"
              ? runtime.cached
                ? t("notebook.readyCached")
                : t("notebook.ready")
              : runtime.phase === "failed"
                ? t("status.failed")
                : t("notebook.idle")}
        </p>
      </div>
      {importError ? (
        <p role="alert" className="mb-3 text-sm text-wrong">
          {t("notebook.importError")}
        </p>
      ) : null}
      <ol className="flex flex-col gap-5">
        {nb.cells.map((c, i) => (
          <li key={c.id} data-cell={c.id}>
            <NotebookCell
              id={c.id}
              index={i}
              code={c.code}
              narrow={narrow}
              first={i === 0}
              last={i === nb.cells.length - 1}
              register={(api) => {
                if (api) cells.current.set(c.id, api);
                else cells.current.delete(c.id);
              }}
              onChange={(code) => {
                update((n) => setCode(n, c.id, code));
              }}
              onRunNext={() => {
                runAndNext(c.id);
              }}
              onMove={(by) => {
                update((n) => moveCell(n, c.id, by));
              }}
              onDelete={() => {
                update((n) => removeCell(n, c.id));
              }}
              onAddBelow={() => {
                update((n) => addCell(n, c.id, newCellId()));
              }}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function NotebookCell(props: {
  id: string;
  index: number;
  code: string;
  narrow: boolean;
  first: boolean;
  last: boolean;
  register: (api: CellApi | null) => void;
  onChange: (code: string) => void;
  onRunNext: () => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
  onAddBelow: () => void;
}) {
  const t = useTranslations("python");
  const { output, run, stop, clear } = useRun();
  const runtime = useRuntimeState();
  const [editing, setEditing] = useState(false);
  const editor = useRef<EditorHandle | null>(null);
  const code = useRef(props.code);
  const showEditor = !props.narrow || editing;

  const registerRef = useRef(props.register);
  const api = useRef<CellApi>({
    run: () => run(code.current),
    clear,
    focus: () => {
      setEditing(true);
      editor.current?.focus();
    },
  });
  // The parent and the editor callbacks read the latest values through these refs.
  useEffect(() => {
    code.current = props.code;
    registerRef.current = props.register;
    api.current.run = () => run(code.current);
    api.current.clear = clear;
  });

  const attach = useCallback((el: HTMLDivElement | null) => {
    registerRef.current(el ? api.current : null);
  }, []);

  const busy =
    output?.status === "queued" || output?.status === "loading" || output?.status === "running";
  const n = props.index + 1;

  return (
    <div ref={attach} className="rounded-md border border-rule bg-surface p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-auto font-mono text-xs text-ink-muted">
          {t("notebook.cell", { n })}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={() => void run(code.current)}
          disabled={busy}
          aria-label={t("notebook.runCell", { n })}
        >
          {t("run")}
        </Button>
        {props.narrow && !editing ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(true);
            }}
          >
            {t("edit")}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={props.first}
          onClick={() => {
            props.onMove(-1);
          }}
          aria-label={t("notebook.moveUp", { n })}
        >
          ↑
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={props.last}
          onClick={() => {
            props.onMove(1);
          }}
          aria-label={t("notebook.moveDown", { n })}
        >
          ↓
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={props.onAddBelow}
          aria-label={t("notebook.addBelow", { n })}
        >
          +
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={props.onDelete}
          aria-label={t("notebook.delete", { n })}
        >
          ×
        </Button>
      </div>
      {showEditor ? (
        <CodeEditor
          initial={props.code}
          label={t("notebook.cell", { n })}
          onChange={props.onChange}
          onRun={() => void run(code.current)}
          onRunNext={props.onRunNext}
          handle={(h) => {
            editor.current = h;
          }}
        />
      ) : (
        <pre className="overflow-x-auto rounded-sm bg-sunken px-3 py-2 font-mono text-xs leading-relaxed">
          {props.code || " "}
        </pre>
      )}
      <OutputPanel output={output} runtime={runtime} onStop={stop} />
    </div>
  );
}
