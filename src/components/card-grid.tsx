"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LayoutGrid, Rows3, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";

/**
 * Generic card view for a list, with the same search box and pagination that
 * `DataTable` provides — those are required on every list (see CLAUDE.md,
 * "UI conventions"), and a prettier layout is no reason to drop them.
 *
 * Use it where records are few and visual (committees, events, study
 * materials, FDPs). Pass `table` to offer a toggle back to the dense
 * `DataTable` view for scanning.
 */

/** Sentinel for the unfiltered chip — not a value any row can hold. */
const ALL = "__all__";

/** Bucket for rows that have no value for a facet. */
const NOT_SET = "— Not set —";

export type Facet<T> = {
  /** Shown before the chips, and used as this filter's key. */
  label: string;
  /** The row's value for this facet; null/"" groups under "Not set". */
  value: (row: T) => string | null | undefined;
  /** Newest-first ordering suits years; defaults to descending. */
  sort?: "asc" | "desc";
};

export default function CardGrid<T extends { id: number }>({
  title,
  subtitle,
  rows,
  searchText,
  card,
  actions,
  table,
  facets,
  pageSize = 9,
  emptyState,
}: {
  title: string;
  subtitle?: string;
  rows: T[];
  /** Text each row is searched by. */
  searchText: (row: T) => string;
  /** Renders one card. */
  card: (row: T) => ReactNode;
  /** Buttons for the header (New …, cross-links). */
  actions?: ReactNode;
  /** The dense alternative; when given, a Grid/Table toggle appears. */
  table?: ReactNode;
  /**
   * Chip filters above the cards — e.g. type and academic year. Values are
   * derived from the rows themselves, so the chips only ever offer what is
   * actually present, and several filters narrow together (AND).
   */
  facets?: Facet<T>[];
  pageSize?: number;
  emptyState?: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"grid" | "table">("grid");
  /** Selected value per facet, keyed by its label; absent means unfiltered. */
  const [picked, setPicked] = useState<Record<string, string>>({});

  const list = useMemo(() => facets ?? [], [facets]);
  const valueFor = (label: string) => picked[label] ?? ALL;

  /** Distinct values present in the rows for each facet, with counts. */
  const facetCounts = useMemo(
    () =>
      list.map((f) => {
        const counts = new Map<string, number>();
        for (const r of rows) {
          const key = (f.value(r) ?? "").trim() || NOT_SET;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const entries = [...counts.entries()];
        entries.sort(([a], [b]) => {
          // "Not set" always sits last, whichever way the rest run.
          if (a === NOT_SET) return 1;
          if (b === NOT_SET) return -1;
          return f.sort === "asc" ? a.localeCompare(b) : b.localeCompare(a);
        });
        return { facet: f, entries };
      }),
    // `value` is defined inline by callers; depending on it would rebuild
    // every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, list.length]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // Every active filter must match — they narrow together.
      for (const f of list) {
        const want = picked[f.label] ?? ALL;
        if (want === ALL) continue;
        if (((f.value(r) ?? "").trim() || NOT_SET) !== want) return false;
      }
      return !q || searchText(r).toLowerCase().includes(q);
    });
    // `searchText`/`value` are defined inline by callers; depending on them
    // would rebuild the list every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, picked, list.length]);

  /** The values currently narrowing the list, for the empty state and reset. */
  const active = list
    .map((f) => ({ label: f.label, value: valueFor(f.label) }))
    .filter((a) => a.value !== ALL);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * pageSize, current * pageSize);

  const chip = (facetLabel: string, value: string, label: string) => (
    <button
      key={`${facetLabel}:${value}`}
      type="button"
      onClick={() => {
        setPicked((p) => ({ ...p, [facetLabel]: value }));
        setPage(1); // a new filter always starts at page 1
      }}
      aria-pressed={valueFor(facetLabel) === value}
      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors ${
        valueFor(facetLabel) === value
          ? "bg-accent-grad text-on-accent ring-transparent"
          : "bg-elevated text-muted ring-line hover:text-fg"
      }`}
    >
      {label}
    </button>
  );

  const toggle = (value: "grid" | "table", icon: ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setView(value)}
      aria-pressed={view === value}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        view === value ? "bg-accent-grad text-on-accent" : "text-muted hover:bg-elevated hover:text-fg"
      }`}
    >
      {icon}
    </button>
  );

  if (view === "table" && table) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-end gap-1 rounded-lg border border-line bg-card p-1 sm:w-fit sm:self-end">
          {toggle("grid", <LayoutGrid className="h-4 w-4" />, "Card view")}
          {toggle("table", <Rows3 className="h-4 w-4" />, "Table view")}
        </div>
        {table}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1); // a new query always starts at page 1
              }}
              placeholder="Search…"
              className="w-48 rounded-lg border border-line bg-elevated py-1.5 pl-8 pr-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
            />
          </div>
          {actions}
          {table && (
            <div className="flex items-center gap-1 rounded-lg border border-line p-0.5">
              {toggle("grid", <LayoutGrid className="h-4 w-4" />, "Card view")}
              {toggle("table", <Rows3 className="h-4 w-4" />, "Table view")}
            </div>
          )}
        </div>
      </div>

      {facetCounts.map(({ facet: f, entries }) =>
        // A filter offering a single value filters nothing — leave it out.
        entries.length > 1 ? (
          <div
            key={f.label}
            className="flex flex-wrap items-center gap-1.5 border-b border-line px-5 py-2.5"
          >
            <span className="w-24 shrink-0 text-xs text-muted">{f.label}</span>
            {chip(f.label, ALL, `All ${rows.length}`)}
            {entries.map(([value, n]) => chip(f.label, value, `${value} ${n}`))}
          </div>
        ) : null
      )}

      {/* With two filters on at once it is easy to lose track — offer a reset. */}
      {active.length > 1 && (
        <div className="flex items-center gap-2 border-b border-line px-5 py-2 text-xs text-muted">
          <span>
            Filtered by {active.map((a) => a.value).join(" + ")} — {filtered.length} of {rows.length}
          </span>
          <button
            type="button"
            onClick={() => {
              setPicked({});
              setPage(1);
            }}
            className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 ring-1 ring-inset ring-line transition-colors hover:text-fg"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      <div className="p-5">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted">
            {search.trim()
              ? `Nothing matches “${search.trim()}”${
                  active.length ? ` in ${active.map((a) => a.value).join(" + ")}` : ""
                }.`
              : active.length
                ? `Nothing in ${active.map((a) => a.value).join(" + ")}.`
                : (emptyState ?? "Nothing here yet.")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pageRows.map((r) => (
              <div key={r.id}>{card(r)}</div>
            ))}
          </div>
        )}
      </div>

      <Pagination page={current} pageSize={pageSize} total={filtered.length} onPage={setPage} />
    </Card>
  );
}
