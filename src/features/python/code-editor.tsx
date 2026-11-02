"use client";

import { useEffect, useRef } from "react";

/**
 * CodeMirror 6 editor for Python (Phase 13), loaded on first use (a separate chunk).
 * Colours come from the same CSS variables as the Shiki-highlighted code in lessons, so
 * it matches both themes. Ctrl/Cmd+Enter runs; Shift+Enter runs and moves on (notebook);
 * Escape, then Tab, leaves the editor (Tab indents while editing).
 */
export type EditorHandle = { focus: () => void; setValue: (code: string) => void };

type Props = {
  initial: string;
  label: string;
  onChange: (code: string) => void;
  onRun: () => void;
  onRunNext?: () => void;
  handle?: (h: EditorHandle | null) => void;
  /** Focus once loaded (after the reader asked to edit, so focus follows their action). */
  focusOnMount?: boolean;
};

async function createEditor(parent: HTMLElement, props: Props) {
  const [
    { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection },
    state,
    commands,
    lang,
    language,
    hl,
  ] = await Promise.all([
    import("@codemirror/view"),
    import("@codemirror/state"),
    import("@codemirror/commands"),
    import("@codemirror/lang-python"),
    import("@codemirror/language"),
    import("@lezer/highlight"),
  ]);
  const { tags: t } = hl;
  const style = language.HighlightStyle.define([
    {
      tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword],
      color: "var(--code-token-keyword)",
    },
    { tag: [t.string, t.special(t.string)], color: "var(--code-token-string)" },
    { tag: [t.number, t.bool, t.null, t.atom], color: "var(--code-token-constant)" },
    { tag: t.comment, color: "var(--code-token-comment)", fontStyle: "italic" },
    {
      tag: [t.function(t.variableName), t.function(t.propertyName)],
      color: "var(--code-token-function)",
    },
    { tag: [t.punctuation, t.bracket, t.operator], color: "var(--code-token-punctuation)" },
  ]);
  const theme = EditorView.theme({
    "&": {
      color: "var(--code-foreground)",
      backgroundColor: "var(--code-background)",
      fontSize: "0.875rem",
      borderRadius: "var(--r)",
    },
    "&.cm-focused": { outline: "2px solid var(--focus)", outlineOffset: "2px" },
    ".cm-content": { fontFamily: "var(--stack-mono)", caretColor: "var(--ink)", padding: "12px 0" },
    ".cm-scroller": { fontFamily: "var(--stack-mono)", lineHeight: "1.55" },
    ".cm-gutters": {
      backgroundColor: "var(--code-background)",
      color: "var(--ink-muted)",
      border: "none",
    },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
    "&.cm-focused .cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--ink) 5%, transparent)",
    },
    ".cm-cursor": { borderLeftColor: "var(--ink)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "color-mix(in srgb, var(--accent) 28%, transparent) !important",
    },
  });
  const run = (fn: () => void) => () => {
    fn();
    return true;
  };
  const view = new EditorView({
    parent,
    state: state.EditorState.create({
      doc: props.initial,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        commands.history(),
        language.indentOnInput(),
        language.bracketMatching(),
        language.syntaxHighlighting(style),
        lang.python(),
        state.Prec.highest(
          keymap.of([
            { key: "Mod-Enter", run: run(props.onRun) },
            { key: "Shift-Enter", run: run(props.onRunNext ?? props.onRun) },
          ]),
        ),
        keymap.of([commands.indentWithTab, ...commands.defaultKeymap, ...commands.historyKeymap]),
        EditorView.contentAttributes.of({ "aria-label": props.label }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) props.onChange(u.state.doc.toString());
        }),
        theme,
      ],
    }),
  });
  return view;
}

export function CodeEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  // Callbacks change every render; the editor reads the latest through this ref.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let view: Awaited<ReturnType<typeof createEditor>> | null = null;
    let cancelled = false;
    void createEditor(parent, {
      ...latest.current,
      onChange: (c) => {
        latest.current.onChange(c);
      },
      onRun: () => {
        latest.current.onRun();
      },
      onRunNext: () => {
        (latest.current.onRunNext ?? latest.current.onRun)();
      },
    }).then((v) => {
      if (cancelled) {
        v.destroy();
        return;
      }
      view = v;
      parent.dataset.ready = "true";
      if (latest.current.focusOnMount) v.focus();
      latest.current.handle?.({
        focus: () => {
          v.focus();
        },
        setValue: (code) => {
          v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: code } });
        },
      });
    });
    return () => {
      cancelled = true;
      latest.current.handle?.(null);
      view?.destroy();
    };
  }, []);

  return <div ref={host} data-code-editor="" className="min-h-12 overflow-hidden rounded-sm" />;
}
