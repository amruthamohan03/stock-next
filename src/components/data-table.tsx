"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";

export type Column<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  className?: string;
  /** Custom cell renderer. Falls back to `value` / row[key] when omitted. */
  render?: (row: T) => ReactNode;
  /** Text used for searching (and as the default cell text). */
  value?: (row: T) => string | number | null | undefined;
};

/**
 * Generic read-only list table with a search box and pagination baked in.
 * Use this (or CrudTable for editable masters) for every list in the app so
 * search + paging behave identically everywhere.
 *
 * Column `render`/`value` are functions, so any page using DataTable must be a
 * Client Component (define the columns in a "use client" wrapper and pass plain
 * serializable rows down from the server page).
 */
export default function DataTable<T extends { id: number | string }>({
  title,
  subtitle,
  columns,
  rows,
  pageSize = 10,
}: {
  title: string;
  subtitle?: string;
  columns: Column<T>[];
  rows: T[];
  pageSize?: number;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      columns.some((c) => {
        const v = c.value ? c.value(r) : (r as Record<string, unknown>)[c.key];
        return String(v ?? "").toLowerCase().includes(q);
      })
    );
  }, [rows, columns, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * pageSize, current * pageSize);

  const cellText = (c: Column<T>, r: T) => {
    if (c.render) return c.render(r);
    const v = c.value ? c.value(r) : (r as Record<string, unknown>)[c.key];
    return v == null || v === "" ? "—" : String(v);
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {subtitle && (
            <span className="text-sm text-slate-400">{subtitle}</span>
          )}
        </div>
        <Input
          placeholder="Search…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-8 w-48"
        />
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-4 py-3 font-semibold ${
                      c.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No records found.
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr
                  key={String(row.id)}
                  className="border-b border-slate-50 transition-colors hover:bg-brand-50/40"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3 text-slate-600 ${
                        c.align === "right" ? "text-right" : ""
                      } ${c.className ?? ""}`}
                    >
                      {cellText(c, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={current}
          pageSize={pageSize}
          total={filtered.length}
          onPage={setPage}
        />
      </CardContent>
    </Card>
  );
}
