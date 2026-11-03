"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

/** The user's column choices for one table: an order and a set to hide. */
export type ColumnLayout = { order: string[]; hidden: string[] };

const EMPTY_LAYOUT: ColumnLayout = { order: [], hidden: [] };

/**
 * Keys starting with "_" (the "#" counter, the Actions cell) are part of the
 * table's frame: they can't be hidden, moved or filtered.
 */
export const isFixedColumn = (key: string) => key.startsWith("_");

function readLayout(storageKey: string): ColumnLayout {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return EMPTY_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<ColumnLayout>;
    return {
      order: Array.isArray(parsed.order) ? parsed.order : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
    };
  } catch {
    return EMPTY_LAYOUT;
  }
}

function writeLayout(storageKey: string, layout: ColumnLayout | null) {
  try {
    if (layout) localStorage.setItem(storageKey, JSON.stringify(layout));
    else localStorage.removeItem(storageKey);
  } catch {
    // Storage blocked (private window etc.) — the layout just won't persist.
  }
}

/**
 * Everything a list table needs besides its markup: global search, one filter
 * per column, a show/hide/reorder layout saved per screen in localStorage, and
 * pagination. Shared by DataTable and CrudTable so both behave identically.
 *
 * `text` returns the searchable/filterable text of a cell.
 */
export function useTableView<T, C extends { key: string; label: string }>({
  rows,
  columns,
  text,
  pageSize,
  tableId,
}: {
  rows: T[];
  columns: C[];
  text: (column: C, row: T) => string;
  pageSize: number;
  /** Distinguishes several tables on one screen (normally the table title). */
  tableId: string;
}) {
  const pathname = usePathname();
  const storageKey = `table-layout:${pathname}:${tableId}`;

  const [search, setSearchState] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  // Loaded after mount: the server render has no localStorage, so reading it
  // during render would make the first client render disagree with the HTML.
  const [layout, setLayoutState] = useState<ColumnLayout>(EMPTY_LAYOUT);
  useEffect(() => setLayoutState(readLayout(storageKey)), [storageKey]);

  const setSearch = (value: string) => {
    setSearchState(value);
    setPage(1);
  };

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const setLayout = useCallback(
    (next: ColumnLayout) => {
      setLayoutState(next);
      writeLayout(storageKey, next);
      // A filter on a column the user can no longer see would silently hide rows.
      setFilters((prev) => {
        const kept = Object.fromEntries(
          Object.entries(prev).filter(([k]) => !next.hidden.includes(k))
        );
        return Object.keys(kept).length === Object.keys(prev).length ? prev : kept;
      });
    },
    [storageKey]
  );

  const resetLayout = () => {
    setLayoutState(EMPTY_LAYOUT);
    writeLayout(storageKey, null);
  };

  /** Movable columns in the user's order; new columns land after known ones. */
  const movable = useMemo(() => {
    const list = columns.filter((c) => !isFixedColumn(c.key));
    const rank = new Map(layout.order.map((k, i) => [k, i]));
    return list
      .map((c, i) => ({ c, r: rank.get(c.key) ?? layout.order.length + i }))
      .sort((a, b) => a.r - b.r)
      .map(({ c }) => c);
  }, [columns, layout.order]);

  /** What the table renders: fixed columns keep their place at either end. */
  const visibleColumns = useMemo(() => {
    const firstMovable = columns.findIndex((c) => !isFixedColumn(c.key));
    const leading = firstMovable === -1 ? columns : columns.slice(0, firstMovable);
    const trailing =
      firstMovable === -1
        ? []
        : columns.slice(firstMovable).filter((c) => isFixedColumn(c.key));
    const hidden = new Set(layout.hidden);
    return [...leading, ...movable.filter((c) => !hidden.has(c.key)), ...trailing];
  }, [columns, movable, layout.hidden]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = Object.entries(filters)
      .map(([k, v]) => [columns.find((c) => c.key === k), v.trim().toLowerCase()] as const)
      .filter((e): e is readonly [C, string] => !!e[0] && e[1] !== "");
    if (!q && active.length === 0) return rows;
    return rows.filter(
      (r) =>
        active.every(([c, v]) => text(c, r).toLowerCase().includes(v)) &&
        (!q || columns.some((c) => text(c, r).toLowerCase().includes(q)))
    );
  }, [rows, columns, text, search, filters]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;

  return {
    search,
    setSearch,
    filters,
    setFilter,
    clearFilters,
    activeFilters: Object.values(filters).filter((v) => v.trim()).length,
    showFilters,
    setShowFilters,
    layout,
    setLayout,
    resetLayout,
    customised: layout.order.length > 0 || layout.hidden.length > 0,
    movableColumns: movable,
    visibleColumns,
    filtered,
    pageRows: filtered.slice(start, start + pageSize),
    pageStart: start,
    page: current,
    setPage,
  };
}

export type TableView = ReturnType<typeof useTableView>;
