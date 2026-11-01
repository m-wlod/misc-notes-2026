"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { SearchIcon } from "@/components/ui/icons";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { cx } from "@/lib/cx";

import type { SearchDoc } from "./docs";
import type { SearchHit } from "./engine";

type Query = (term: string) => Promise<SearchHit[]>;

/** Loads Orama and this locale's index once, on first open (nothing on page load). */
const loaded = new Map<string, Promise<Query>>();
function loadQuery(locale: string): Promise<Query> {
  let promise = loaded.get(locale);
  if (!promise) {
    promise = Promise.all([
      import("./engine"),
      fetch(`/search/${locale}.json`).then((r) => {
        if (!r.ok) throw new Error(`search index ${String(r.status)}`);
        return r.json() as Promise<SearchDoc[]>;
      }),
    ]).then(([engine, docs]) => engine.createSearchIndex(docs));
    promise.catch(() => loaded.delete(locale)); // retry on the next open
    loaded.set(locale, promise);
  }
  return promise;
}

const GROUPS = ["lesson", "term"] as const;

/**
 * Site search in the top bar: a dialog with a combobox. Arrow keys move through the
 * results, Enter opens one, Escape closes. Also opens with "/" or Ctrl/⌘+K.
 */
export function SearchDialog() {
  const t = useTranslations("common.search");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [active, setActive] = useState(0);
  const listId = useId();
  const latest = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  // Global shortcuts.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.isContentEditable === true ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  async function run(value: string) {
    setTerm(value);
    setActive(0);
    const ticket = ++latest.current;
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    try {
      if (status !== "ready") setStatus("loading");
      const query = await loadQuery(locale);
      const result = await query(value);
      if (ticket !== latest.current) return; // a newer query already answered
      setHits(result);
      setStatus("ready");
    } catch {
      if (ticket === latest.current) setStatus("error");
    }
  }

  // Grouped for display; `ordered` is the keyboard order.
  const ordered = GROUPS.flatMap((g) => hits.filter((h) => h.type === g));
  const optionId = (i: number) => `${listId}-${String(i)}`;

  function go(hit: SearchHit | undefined) {
    if (!hit) return;
    setOpen(false);
    router.push(hit.url);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (ordered.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + ordered.length) % ordered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(ordered[active]);
    }
  }

  const showResults = term.trim().length >= 2;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTerm("");
          setHits([]);
        }
      }}
    >
      <DialogTrigger
        aria-label={t("label")}
        className="flex size-9 items-center justify-center rounded text-ink-muted hover:bg-sunken hover:text-ink"
      >
        <SearchIcon />
      </DialogTrigger>
      <DialogContent
        title={t("label")}
        closeLabel={t("close")}
        onOpenAutoFocus={(e) => {
          // Start in the search field, not on the close button that comes first.
          e.preventDefault();
          input.current?.focus();
        }}
        className="top-[12vh] w-[min(40rem,calc(100vw-2rem))] translate-y-0"
      >
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-label={t("label")}
          aria-expanded={showResults && ordered.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={ordered.length > 0 ? optionId(active) : undefined}
          placeholder={t("placeholder")}
          value={term}
          onChange={(e) => {
            void run(e.target.value);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded border border-rule-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-muted"
        />
        <p role="status" className="mt-2 min-h-5 font-sans text-xs text-ink-muted">
          {!showResults
            ? t("hint")
            : status === "loading"
              ? t("loading")
              : status === "error"
                ? t("error")
                : ordered.length === 0
                  ? t("empty", { term: term.trim() })
                  : t("count", { count: ordered.length })}
        </p>
        <div id={listId} role="listbox" aria-label={t("results")} className="mt-2 grid gap-4">
          {GROUPS.map((group) => {
            const inGroup = ordered
              .map((hit, i) => ({ hit, i }))
              .filter(({ hit }) => hit.type === group);
            if (inGroup.length === 0) return null;
            return (
              <div key={group} role="presentation">
                <p
                  id={`${listId}-${group}`}
                  className="mb-1 font-sans text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase"
                >
                  {t(`groups.${group}`)}
                </p>
                <div role="group" aria-labelledby={`${listId}-${group}`} className="grid gap-1">
                  {inGroup.map(({ hit, i }) => (
                    // Combobox with aria-activedescendant: focus stays on the input, which
                    // handles the keys; options are deliberately not focusable (WAI-ARIA APG).
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
                    <div
                      key={hit.id}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === active}
                      onPointerMove={() => {
                        setActive(i);
                      }}
                      onClick={() => {
                        go(hit);
                      }}
                      className={cx(
                        "cursor-pointer rounded px-3 py-2",
                        i === active ? "bg-sunken" : "hover:bg-sunken",
                      )}
                    >
                      <span className="block font-serif text-base text-ink">{hit.title}</span>
                      <span className="block font-sans text-xs text-ink-muted">{hit.context}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
