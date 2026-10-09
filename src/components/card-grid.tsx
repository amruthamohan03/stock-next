"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LayoutGrid, Rows3, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";

/**
 * Generic card view for a list, with the same search box and pagination that
 * `DataTable` provides — those are required on every list (see CLAUDE.md,
 * "UI conventions"), and a prettier layout is no reason to drop them.
 *
 * Use it where records are few and visual (committees, events). Pass `table`
 * to offer a toggle back to the dense `DataTable` view for scanning.
 */
/** Sentinel for the unfiltered chip — not a value any row can hold. */
const ALL = "__all__";

export default function CardGrid<T extends { id: number }>({
  title,
  subtitle,
  rows,
  searchText,
  card,
  actions,
  table,
  facet,
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
   * Optional chip filter above the cards — e.g. academic year. Values are
   * derived from the rows themselves, so the chips only ever offer what is
   * actually there.
   */
  facet?: {
    label: string;
    /** The row's value for this facet; null/"" groups under "Not set". */
    value: (row: T) => string | null | undefined;
    /** Newest-first ordering suits years; defaults to descending. */
    sort?: "asc" | "desc";
  };
  pageSize?: number;
  emptyState?: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [facetValue, setFacetValue] = useState<string>(ALL);

  const NOT_SET = "— Not set —";

  /** Distinct facet values present in the rows, with their counts. */
  const facetCounts = useMemo(() => {
    if (!facet) return [];
    const counts = new Map<string, number>();
    for (const r of rows) {
      const key = (facet.value(r) ?? "").trim() || NOT_SET;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const entries = [...counts.entries()];
    entries.sort(([a], [b]) => {
      // "Not set" always sits last, whichever direction the rest run in.
      if (a === NOT_SET) return 1;
      if (b === NOT_SET) return -1;
      return facet.sort === "asc" ? a.localeCompare(b) : b.localeCompare(a);
    });
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, !!facet]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (facet && facetValue !== ALL) {
        const key = (facet.value(r) ?? "").trim() || NOT_SET;
        if (key !== facetValue) return false;
      }
      return !q || searchText(r).toLowerCase().includes(q);
    });
    // `searchText`/`facet.value` are defined inline by callers; depending on
    // them would rebuild the list every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, facetValue]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * pageSize, current * pageSize);

  const chip = (value: string, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => {
        setFacetValue(value);
        setPage(1); // a new filter always starts at page 1
      }}
      aria-pressed={facetValue === value}
      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors ${
        facetValue === value
          ? "bg-accent text-accent-fg ring-transparent"
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
        view === value ? "bg-accent text-accent-fg" : "text-muted hover:bg-elevated hover:text-fg"
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

      {facet && facetCounts.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-5 py-3">
          <span className="mr-0.5 text-xs text-muted">{facet.label}</span>
          {chip(ALL, `All ${rows.length}`)}
          {facetCounts.map(([value, n]) => chip(value, `${value} ${n}`))}
        </div>
      )}

      <div className="p-5">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted">
            {search.trim()
              ? `Nothing matches “${search.trim()}”${facetValue !== ALL ? ` in ${facetValue}` : ""}.`
              : facetValue !== ALL
                ? `Nothing in ${facetValue}.`
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
