"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Columns3, Filter, FilterX, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isFixedColumn, type TableView } from "@/lib/use-table-view";

/** Small pill showing a count on a toolbar button. */
function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span className="ml-0.5 rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-on-accent">
      {children}
    </span>
  );
}

/**
 * Card classes for a list table. Card clips its children, which would cut off
 * the Columns popover on a short list, so the card overflows and the header
 * and body round their own corners instead.
 */
export const tableCardClasses = {
  card: "overflow-visible",
  header: "rounded-t-2xl",
  content: "overflow-hidden rounded-b-2xl p-0",
};

/**
 * The header controls every list shares: global search, the per-column Filter
 * toggle and the Columns chooser. Extra buttons (e.g. CrudTable's Add) go in
 * `children`, after the built-in ones.
 */
export function TableToolbar({ view, children }: { view: TableView; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search…"
        aria-label="Search this list"
        value={view.search}
        onChange={(e) => view.setSearch(e.target.value)}
        className="h-8 w-44"
      />
      <Button
        size="sm"
        variant={view.showFilters ? "soft" : "outline"}
        aria-pressed={view.showFilters}
        onClick={() => view.setShowFilters(!view.showFilters)}
        title="Filter by individual columns"
      >
        <Filter className="h-4 w-4" /> Filter
        {view.activeFilters > 0 && <CountBadge>{view.activeFilters}</CountBadge>}
      </Button>
      <ColumnChooser view={view} />
      {children}
    </div>
  );
}

/**
 * The row of per-column filter boxes, rendered as a second header row while
 * the Filter toggle is on. `leading`/`trailing` add blank cells for columns a
 * table draws outside its column list (CrudTable's # and Actions).
 */
export function FilterRow({
  view,
  columns,
  leading = 0,
  trailing = 0,
}: {
  view: TableView;
  columns: { key: string; label: string }[];
  leading?: number;
  trailing?: number;
}) {
  if (!view.showFilters) return null;
  const cells: ReactNode[] = [];
  const clear = (
    <button
      type="button"
      onClick={view.clearFilters}
      disabled={view.activeFilters === 0}
      title="Clear all column filters"
      aria-label="Clear all column filters"
      className="rounded p-1 text-faint hover:bg-card hover:text-fg disabled:opacity-40"
    >
      <FilterX className="h-4 w-4" />
    </button>
  );
  let clearPlaced = false;
  const blank = (key: string) => {
    const content = clearPlaced ? null : clear;
    clearPlaced = true;
    return (
      <th key={key} className="!py-2">
        {content}
      </th>
    );
  };

  for (let i = 0; i < leading; i++) cells.push(blank(`_lead${i}`));
  for (const c of columns) {
    cells.push(
      isFixedColumn(c.key) ? (
        blank(c.key)
      ) : (
        <th key={c.key} className="!py-2 !font-normal !normal-case !tracking-normal">
          <Input
            placeholder="Filter…"
            aria-label={`Filter ${c.label}`}
            value={view.filters[c.key] ?? ""}
            onChange={(e) => view.setFilter(c.key, e.target.value)}
            className="h-7 min-w-24 text-xs"
          />
        </th>
      )
    );
  }
  for (let i = 0; i < trailing; i++) cells.push(blank(`_trail${i}`));
  return <tr>{cells}</tr>;
}

/** On/off switch for one column in the chooser. */
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-line"
      }`}
    >
      <span
        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${
          checked ? "left-3.5" : "left-0.5"
        }`}
      />
    </button>
  );
}

/**
 * Show, hide and reorder a table's columns. Reordering uses up/down buttons
 * rather than drag-and-drop so it works from the keyboard too. The choice is
 * saved per screen in this browser.
 */
function ColumnChooser({ view }: { view: TableView }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setQuery("");
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const columns = view.movableColumns;
  const hidden = new Set(view.layout.hidden);
  const total = columns.length;
  const shown = columns.filter((c) => !hidden.has(c.key)).length;
  const q = query.trim().toLowerCase();
  const listed = q ? columns.filter((c) => c.label.toLowerCase().includes(q)) : columns;

  const toggle = (key: string, show: boolean) => {
    // Keep at least one column, or the table has nothing left to show.
    if (!show && shown <= 1) return;
    view.setLayout({
      order: view.layout.order,
      hidden: show ? view.layout.hidden.filter((k) => k !== key) : [...view.layout.hidden, key],
    });
  };

  // Swap with the neighbour in the full order, so the saved order lists every column.
  const move = (index: number, delta: -1 | 1) => {
    const order = columns.map((c) => c.key);
    [order[index], order[index + delta]] = [order[index + delta], order[index]];
    view.setLayout({ order, hidden: view.layout.hidden });
  };

  if (total === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <Button
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        title="Choose which columns to show, and their order"
      >
        <Columns3 className="h-4 w-4" /> Columns
        {shown < total && (
          <CountBadge>
            {shown}/{total}
          </CountBadge>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose columns"
          className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-line bg-card shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-sm font-semibold text-fg">Columns</span>
            <button
              type="button"
              onClick={view.resetLayout}
              disabled={!view.customised}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg disabled:opacity-40"
              title="Back to the default columns and order"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>

          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <Input
              placeholder="Search columns…"
              aria-label="Search columns"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <ul className="max-h-80 overflow-y-auto py-1">
            {listed.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-faint">
                No column matches “{query.trim()}”.
              </li>
            )}
            {listed.map((c) => {
              const index = columns.indexOf(c);
              const isHidden = hidden.has(c.key);
              const arrow =
                "rounded p-0.5 text-muted hover:bg-elevated hover:text-fg disabled:opacity-30";
              return (
                <li key={c.key} className="flex items-center gap-2 px-3 py-1.5 hover:bg-elevated">
                  <Switch
                    checked={!isHidden}
                    onChange={(on) => toggle(c.key, on)}
                    label={`Show the ${c.label} column`}
                  />
                  <span
                    className={`flex-1 truncate text-sm ${isHidden ? "text-faint" : "text-fg"}`}
                    title={c.label}
                  >
                    {c.label}
                  </span>
                  {/* While searching, neighbours are filtered out, so a move
                      would jump past rows the user can't see. */}
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={!!q || index === 0}
                    aria-label={`Move ${c.label} earlier`}
                    className={arrow}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={!!q || index === total - 1}
                    aria-label={`Move ${c.label} later`}
                    className={arrow}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="border-t border-line px-3 py-2 text-[11px] text-faint">
            Saved in this browser for this screen.
          </p>
        </div>
      )}
    </div>
  );
}
