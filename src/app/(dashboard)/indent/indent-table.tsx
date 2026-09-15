"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete } from "@/lib/api-client";
import { Eye, Pencil, Trash2, Receipt } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";

export type IndentRow = {
  id: number;
  indent_no: string | null;
  indent_date: string | Date | null;
  purpose: string | null;
  status: string | null;
  item_type: string | null;
  department_name: string | null;
  has_bill: boolean;
  item_count: number;
  total_qty: number;
};

export default function IndentTable({ rows }: { rows: IndentRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = async (row: IndentRow) => {
    const ok = await confirm({
      title: `Delete indent ${row.indent_no ?? row.id}?`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(row.id);
    const result = await apiDelete(`/api/indent?id=${row.id}`);
    setDeleting(null);
    if (toast.fromResult(result, { success: "Indent deleted" })) router.refresh();
  };

  const columns: Column<IndentRow>[] = useMemo(
    () => [
      {
        key: "_sl",
        label: "#",
        className: "w-12 text-slate-400",
        render: (_r, i) => i + 1,
      },
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
          <span className="block max-w-sm truncate">{r.purpose || "—"}</span>
        ),
      },
      {
        key: "item_type",
        label: "Type",
        value: (r) => (r.item_type === "C" ? "Consumable" : "Non-consumable"),
        render: (r) => (
          <span
            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
              r.item_type === "C"
                ? "bg-teal-50 text-teal-700 ring-teal-200"
                : "bg-indigo-50 text-indigo-700 ring-indigo-200"
            }`}
          >
            {r.item_type === "C" ? "Consumable" : "Non-consumable"}
          </span>
        ),
      },
      {
        key: "item_count",
        label: "Items",
        align: "right",
        value: (r) => r.item_count,
        render: (r) => (
          <span className="inline-flex min-w-[1.75rem] justify-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
            {r.item_count}
          </span>
        ),
      },
      {
        key: "total_qty",
        label: "Qty",
        align: "right",
        value: (r) => r.total_qty,
        render: (r) => (
          <span className="font-semibold text-slate-700">{r.total_qty}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        value: (r) => r.status,
        render: (r) => <StatusBadge status={r.status} />,
      },
      {
        key: "has_bill",
        label: "Bill",
        align: "right",
        className: "w-14",
        value: (r) => (r.has_bill ? "yes" : ""),
        render: (r) =>
          r.has_bill ? (
            <Receipt className="ml-auto h-4 w-4 text-emerald-500" aria-label="Bill attached" />
          ) : (
            <span className="text-faint">—</span>
          ),
      },
      {
        key: "_actions",
        label: "Actions",
        align: "right",
        className: "w-32",
        render: (r) => (
          <TableActions>
            <TableAction tone="view" icon={Eye} href={`/indent/${r.id}`} title="View indent" />
            <TableAction tone="edit" icon={Pencil} href={`/indent/${r.id}/edit`} title="Edit indent" />
            <TableAction
              tone="delete"
              icon={Trash2}
              onClick={() => remove(r)}
              disabled={deleting === r.id}
              title="Delete indent"
            />
          </TableActions>
        ),
      },
    ],
    [deleting]
  );

  return (
    <DataTable
      title="Indent Book"
      subtitle={`${rows.length} indents`}
      columns={columns}
      rows={rows}
      minWidth="72rem"
    />
  );
}
