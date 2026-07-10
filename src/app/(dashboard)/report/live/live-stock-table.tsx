"use client";

import DataTable, { type Column } from "@/components/data-table";
import { StatCards, type Stat } from "@/components/stat-cards";
import { formatDate } from "@/lib/utils";

export type LiveStockRow = {
  item_id: number;
  item_name: string | null;
  opening_balance: number;
  current_balance: number;
  total_receipt: number;
  total_issued: number;
  transferred_qty: number;
  working_receipt: number;
  not_working_receipt: number;
  locations_list: string | null;
  last_transaction_date: string | Date | null;
};

// DataTable keys must be unique; use item_id as the row id.
type Row = LiveStockRow & { id: number };

const columns: Column<Row>[] = [
  {
    key: "item_name",
    label: "Item",
    value: (r) => r.item_name,
    render: (r) => (
      <span className="font-medium text-slate-700">{r.item_name ?? "—"}</span>
    ),
  },
  { key: "opening_balance", label: "Opening", align: "right", value: (r) => r.opening_balance },
  {
    key: "total_receipt",
    label: "Received",
    align: "right",
    value: (r) => r.total_receipt,
    render: (r) => <span className="text-emerald-700">{r.total_receipt || ""}</span>,
  },
  {
    key: "total_issued",
    label: "Issued",
    align: "right",
    value: (r) => r.total_issued,
    render: (r) => <span className="text-red-700">{r.total_issued || ""}</span>,
  },
  { key: "transferred_qty", label: "Transferred", align: "right", value: (r) => r.transferred_qty },
  {
    key: "current_balance",
    label: "Balance",
    align: "right",
    value: (r) => r.current_balance,
    render: (r) => (
      <span className="font-medium text-slate-800">{r.current_balance}</span>
    ),
  },
  { key: "working_receipt", label: "Working", align: "right", value: (r) => r.working_receipt },
  {
    key: "not_working_receipt",
    label: "Not Working",
    align: "right",
    value: (r) => r.not_working_receipt,
  },
  {
    key: "locations_list",
    label: "Locations",
    value: (r) => r.locations_list,
    render: (r) => (
      <span className="block max-w-xs truncate text-slate-500">
        {r.locations_list || "—"}
      </span>
    ),
  },
  {
    key: "last_transaction_date",
    label: "Last Activity",
    value: (r) => (r.last_transaction_date ? String(r.last_transaction_date) : ""),
    render: (r) => formatDate(r.last_transaction_date),
  },
];

export default function LiveStockTable({ rows }: { rows: LiveStockRow[] }) {
  const data: Row[] = rows.map((r) => ({ ...r, id: r.item_id }));

  const sum = (key: keyof LiveStockRow) =>
    rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  const stats: Stat[] = [
    { label: "Items", value: rows.length },
    { label: "Total Received", value: sum("total_receipt"), tone: "success" },
    { label: "Total Issued", value: sum("total_issued"), tone: "warning" },
    { label: "Total Current Balance", value: sum("current_balance"), tone: "primary" },
  ];

  return (
    <div className="space-y-5">
      <StatCards stats={stats} />
      <DataTable
        title="Live Stock Register"
        subtitle={`${rows.length} items`}
        columns={columns}
        rows={data}
      />
    </div>
  );
}
