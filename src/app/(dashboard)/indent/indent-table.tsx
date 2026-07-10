"use client";

import DataTable, { type Column } from "@/components/data-table";
import { formatDate } from "@/lib/utils";

export type IndentRow = {
  id: number;
  indent_no: string | null;
  indent_date: string | Date | null;
  purpose: string | null;
  status: string | null;
  item_type: string | null;
  department_name: string | null;
  item_count: number;
  total_qty: number;
};

const statusColor: Record<string, string> = {
  CREATED: "bg-slate-100 text-slate-600",
  VERIFIED: "bg-blue-50 text-blue-700",
  PASSED: "bg-violet-50 text-violet-700",
  ISSUED: "bg-amber-50 text-amber-700",
  RECEIVED: "bg-emerald-50 text-emerald-700",
};

const columns: Column<IndentRow>[] = [
  {
    key: "indent_no",
    label: "Indent No",
    value: (r) => r.indent_no,
    render: (r) => (
      <span className="font-medium text-slate-700">{r.indent_no}</span>
    ),
  },
  {
    key: "indent_date",
    label: "Date",
    value: (r) => (r.indent_date ? String(r.indent_date) : ""),
    render: (r) => formatDate(r.indent_date),
  },
  { key: "department_name", label: "Department", value: (r) => r.department_name },
  {
    key: "purpose",
    label: "Purpose",
    value: (r) => r.purpose,
    render: (r) => (
      <span className="block max-w-xs truncate">{r.purpose || "—"}</span>
    ),
  },
  {
    key: "item_type",
    label: "Type",
    value: (r) => (r.item_type === "C" ? "Consumable" : "Non-consumable"),
    render: (r) => (r.item_type === "C" ? "Consumable" : "Non-consumable"),
  },
  { key: "item_count", label: "Items", align: "right", value: (r) => r.item_count },
  { key: "total_qty", label: "Qty", align: "right", value: (r) => r.total_qty },
  {
    key: "status",
    label: "Status",
    value: (r) => r.status,
    render: (r) => (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          statusColor[r.status ?? "CREATED"] ?? "bg-slate-100 text-slate-600"
        }`}
      >
        {r.status}
      </span>
    ),
  },
];

export default function IndentTable({ rows }: { rows: IndentRow[] }) {
  return (
    <DataTable
      title="Indent Book"
      subtitle={`${rows.length} indents`}
      columns={columns}
      rows={rows}
    />
  );
}
