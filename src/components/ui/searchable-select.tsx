"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { csvParts, toggleCsv } from "@/lib/csv-values";

export type SelectOption = { value: string | number; label: string };

/** One option row ≈ py-1.5 (12px) + text-sm line-height (20px). */
const ROW_PX = 32;
/** Show up to 15 options before the list starts scrolling. */
const MAX_VISIBLE_OPTIONS = 15;
/** Height of the search row (input + bottom border). */
const SEARCH_PX = 41;
/** ul py-1 (top + bottom). */
const LIST_PAD_PX = 8;
/** Gap between the trigger and the panel, and from the viewport edge. */
const GAP_PX = 4;
const EDGE_PX = 8;
const MIN_LIST_PX = 120;

type Pos = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxList: number;
};

/**
 * Searchable dropdown (combobox). Use this for EVERY select in the app instead
 * of a native <select> — the option list is filterable, which matters for long
 * master lists (items, models, departments, …).
 *
 * The panel renders in a portal with fixed positioning so it is never clipped
 * by a scrolling table or a modal, and it flips above the trigger when there
 * isn't room below. It shows up to 15 options (or as many as fit) before
 * scrolling.
 *
 * With `multiple`, the same control picks several options: `value` is then a
 * comma-separated list in the order of `options`, the panel stays open while
 * choices are toggled, and the trigger summarises the selection. Report filters
 * use that to put "department in (1,2)" style conditions in the URL.
 *
 * Note: native `required` doesn't apply to a custom control, so forms that use
 * this must validate required selects themselves (see CrudTable.submit).
 */
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  multiple = false,
}: {
  id?: string;
  /** Single mode: the chosen value. Multiple: a comma-separated list. */
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - GAP_PX - EDGE_PX;
    const above = r.top - GAP_PX - EDGE_PX;
    const wanted = MAX_VISIBLE_OPTIONS * ROW_PX + LIST_PAD_PX + SEARCH_PX;
    // Flip up only when below can't fit the panel and above has more room.
    const up = below < Math.min(wanted, MIN_LIST_PX + SEARCH_PX) && above > below;
    const space = up ? above : below;
    const maxList = Math.max(
      MIN_LIST_PX,
      Math.min(MAX_VISIBLE_OPTIONS * ROW_PX, space - SEARCH_PX - LIST_PAD_PX)
    );
    setPos({
      left: r.left,
      width: r.width,
      ...(up
        ? { bottom: window.innerHeight - r.top + GAP_PX }
        : { top: r.bottom + GAP_PX }),
      maxList,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    // Keep the panel glued to the trigger while an ancestor scrolls / resizes.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const order = options.map((o) => String(o.value));
  const picked = multiple ? csvParts(value) : [];
  const selected = options.find((o) => String(o.value) === String(value));
  // What the closed trigger says: the one label, "n selected", or the placeholder.
  const triggerLabel = multiple
    ? picked.length === 0
      ? placeholder
      : picked.length === 1
        ? (options.find((o) => String(o.value) === picked[0])?.label ?? `#${picked[0]}`)
        : `${picked.length} selected`
    : (selected?.label ?? placeholder);
  const hasValue = multiple ? picked.length > 0 : !!selected;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options;

  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        ref={triggerRef}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-lg border border-line bg-elevated px-3 text-sm shadow-sm transition-colors hover:border-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35 disabled:cursor-not-allowed disabled:opacity-60",
          hasValue ? "text-fg" : "text-faint"
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-faint" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
            }}
            className="z-50 overflow-hidden rounded-lg border border-line bg-card shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-line px-2">
              <Search className="h-4 w-4 shrink-0 text-faint" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="h-8 w-full bg-transparent text-sm text-fg outline-none placeholder:text-faint"
              />
            </div>
            <ul className="overflow-y-auto py-1" style={{ maxHeight: pos.maxList }}>
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-faint">No matches</li>
              )}
              {filtered.map((o) => {
                const v = String(o.value);
                const active = multiple ? picked.includes(v) : v === String(value);
                return (
                  <li key={v}>
                    <button
                      type="button"
                      onClick={() => {
                        if (multiple) {
                          // Stay open: picking several is the whole point.
                          onChange(toggleCsv(value, v, order));
                          return;
                        }
                        onChange(v);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-fg hover:bg-elevated",
                        active && "bg-accent-soft font-medium text-accent-fg"
                      )}
                    >
                      <span className="truncate">{o.label}</span>
                      {active && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            {multiple && picked.length > 0 && (
              <div className="border-t border-line p-1">
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs font-medium text-muted hover:bg-elevated hover:text-fg"
                >
                  <X className="h-3.5 w-3.5" /> Clear {picked.length} selected
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
