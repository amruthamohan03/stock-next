"use client";

import DataTable, { type Column } from "@/components/data-table";
import { formatDate } from "@/lib/utils";

export type StockRow = {
  id: number;
  transaction_date: string | Date | null;
  item_name: string | null;
  location: string | null;
  transaction_type: string;
  receipt_qty: number | null;
  issue_qty: number | null;
  balance_qty: number | null;
  item_status: string | null;
  to_name: string | null;
  from_name: string | null;
  remarks: string | null;
};

const typeColor: Record<string, string> = {
  RECEIPT: "bg-emerald-50 text-emerald-700",
  ISSUE: "bg-red-50 text-red-700",
  TRANSFER: "bg-blue-50 text-blue-700",
  ADJUSTMENT: "bg-amber-50 text-amber-700",
  BROUGHT_FORWARD: "bg-slate-100 text-slate-600",
};

const columns: Column<StockRow>[] = [
  {
    key: "transaction_date",
    label: "Date",
    value: (r) => (r.transaction_date ? String(r.transaction_date) : ""),
    render: (r) => (
      <span className="whitespace-nowrap">{formatDate(r.transaction_date)}</span>
    ),
  },
  {
    key: "item_name",
    label: "Item",
    value: (r) => r.item_name,
    render: (r) => <span className="text-slate-700">{r.item_name ?? "—"}</span>,
  },
  {
    key: "transaction_type",
    label: "Type",
    value: (r) => r.transaction_type,
    render: (r) => (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          typeColor[r.transaction_type] ?? "bg-slate-100 text-slate-600"
        }`}
      >
        {r.transaction_type}
      </span>
    ),
  },
  {
    key: "receipt_qty",
    label: "Receipt",
    align: "right",
    value: (r) => r.receipt_qty,
    render: (r) => (
      <span className="text-emerald-700">{r.receipt_qty || ""}</span>
    ),
  },
  {
    key: "issue_qty",
    label: "Issue",
    align: "right",
    value: (r) => r.issue_qty,
    render: (r) => <span className="text-red-700">{r.issue_qty || ""}</span>,
  },
  {
    key: "balance_qty",
    label: "Balance",
    align: "right",
    value: (r) => r.balance_qty,
    render: (r) => (
      <span className="font-medium text-slate-700">{r.balance_qty}</span>
    ),
  },
  {
    key: "location",
    label: "To / From",
    value: (r) => r.to_name ?? r.from_name ?? "",
    render: (r) => r.to_name ?? r.from_name ?? "—",
  },
  { key: "item_status", label: "Status", value: (r) => r.item_status },
  {
    key: "remarks",
    label: "Remarks",
    value: (r) => r.remarks,
    render: (r) => (
      <span className="block max-w-xs truncate text-slate-500">
        {r.remarks || "—"}
      </span>
    ),
  },
];

export default function StockTable({ rows }: { rows: StockRow[] }) {
  return (
    <DataTable
      title="Stock Ledger"
      subtitle={`Latest ${rows.length} transactions`}
      columns={columns}
      rows={rows}
    />
  );
}
