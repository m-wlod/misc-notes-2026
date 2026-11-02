"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import type { EditorHandle } from "./code-editor";
import { OutputPanel } from "./output-panel";
import { useRun, useRuntimeState } from "./use-run";

const noop = () => () => undefined;
/** False in the server HTML, true once hydrated: a click before that would be lost. */
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

const CodeEditor = dynamic(() => import("./code-editor").then((m) => m.CodeEditor), {
  ssr: false,
});

/**
 * A runnable code example in a lesson (Phase 13). The server renders the highlighted
 * code (no JS cost until used); Run executes it as is, Edit swaps in the editor. Cells on
 * a page share one Python session, so later cells see earlier variables.
 */
export function PythonCellClient({ children }: { children: ReactNode }) {
  const t = useTranslations("python");
  const box = useRef<HTMLDivElement>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const editor = useRef<EditorHandle | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const { output, run, stop, warm } = useRun();
  const runtime = useRuntimeState();
  const hydrated = useHydrated();

  /** The code as written in the lesson, read once from the server-rendered block. */
  const source = () => {
    if (original !== null) return original;
    const read = (box.current?.querySelector("pre")?.textContent ?? "").replace(/\s+$/, "");
    setOriginal(read);
    return read;
  };
  const current = () => code ?? source();

  const onRun = () => {
    void run(current());
  };
  const onEdit = () => {
    warm();
    setCode(current());
    setEditing(true);
  };
  const onReset = () => {
    const c = source();
    setCode(c);
    editor.current?.setValue(c);
  };

  const busy =
    output?.status === "queued" || output?.status === "loading" || output?.status === "running";

  return (
    <div data-python-cell="" className="my-7">
      <div ref={box} hidden={editing}>
        {children}
      </div>
      {editing ? (
        <CodeEditor
          initial={code ?? ""}
          label={t("editorLabel")}
          focusOnMount
          onChange={setCode}
          onRun={onRun}
          handle={(h) => {
            editor.current = h;
          }}
        />
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={onRun} disabled={!hydrated || busy}>
          {t("run")}
        </Button>
        {editing ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onReset}
            disabled={code === original}
          >
            {t("reset")}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={onEdit} disabled={!hydrated}>
            {t("edit")}
          </Button>
        )}
        {editing ? (
          <p className="hidden font-sans text-xs text-ink-muted sm:block">{t("keys")}</p>
        ) : null}
      </div>
      <OutputPanel output={output} runtime={runtime} onStop={stop} />
    </div>
  );
}
