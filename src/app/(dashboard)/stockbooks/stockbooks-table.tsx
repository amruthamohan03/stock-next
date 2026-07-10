"use client";

import DataTable, { type Column } from "@/components/data-table";
import { StatCards, type Stat } from "@/components/stat-cards";
import { formatDate } from "@/lib/utils";

export type StockBookRow = {
  id: number;
  item_name: string | null;
  location: string | null;
  opening_balance: number | null;
  current_balance: number | null;
  updated_at: string | Date | null;
};

const columns: Column<StockBookRow>[] = [
  {
    key: "item_name",
    label: "Item Name",
    value: (r) => r.item_name,
    render: (r) => (
      <span className="font-medium text-slate-700">{r.item_name ?? "—"}</span>
    ),
  },
  { key: "location", label: "Location", value: (r) => r.location },
  {
    key: "opening_balance",
    label: "Opening",
    align: "right",
    value: (r) => r.opening_balance ?? 0,
  },
  {
    key: "current_balance",
    label: "Current",
    align: "right",
    value: (r) => r.current_balance ?? 0,
    render: (r) => (
      <span className="font-medium text-slate-800">{r.current_balance ?? 0}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    value: (r) => ((r.current_balance ?? 0) > 0 ? "In stock" : "Out of stock"),
    render: (r) => {
      const inStock = (r.current_balance ?? 0) > 0;
      return (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            inStock
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {inStock ? "In stock" : "Out of stock"}
        </span>
      );
    },
  },
  {
    key: "updated_at",
    label: "Last Updated",
    value: (r) => (r.updated_at ? String(r.updated_at) : ""),
    render: (r) => formatDate(r.updated_at),
  },
];

export default function StockBooksTable({ rows }: { rows: StockBookRow[] }) {
  const inStock = rows.filter((r) => (r.current_balance ?? 0) > 0).length;
  const totalQty = rows.reduce((sum, r) => sum + (r.current_balance ?? 0), 0);

  const stats: Stat[] = [
    { label: "Total Stock Books", value: rows.length },
    { label: "Items in Stock", value: inStock, tone: "success" },
    { label: "Out of Stock", value: rows.length - inStock, tone: "warning" },
    { label: "Total Current Stock", value: totalQty, tone: "primary" },
  ];

  return (
    <div className="space-y-5">
      <StatCards stats={stats} />
      <DataTable
        title="Stock Books"
        subtitle={`${rows.length} stock books`}
        columns={columns}
        rows={rows}
      />
    </div>
  );
}
