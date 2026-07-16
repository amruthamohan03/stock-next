"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { creatorColumns, signedByColumn } from "@/components/table-columns";
import { formatDate, formatDateTime } from "@/lib/utils";

export type KfcFormRow = {
  id: number;
  title: string | null;
  form_date: string | Date | null;
  item_count: number;
  created_at: string | Date | null;
  created_by_name: string | null;
  role_name: string | null;
  signed_by_name: string | null;
};

export default function KfcList({ rows }: { rows: KfcFormRow[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = async (row: KfcFormRow) => {
    if (!confirm(`Delete "${row.title ?? row.id}"?`)) return;
    setDeleting(row.id);
    const res = await fetch(`/api/kfc-form-13?id=${row.id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(null);
    if (json.success) router.refresh();
    else alert(json.message ?? "Delete failed");
  };

  const columns: Column<KfcFormRow>[] = useMemo(
    () => [
      { key: "_sl", label: "#", className: "w-12 text-faint", render: (_r, i) => i + 1 },
      {
        key: "title",
        label: "Title",
        value: (r) => r.title,
        render: (r) => <span className="font-medium text-fg">{r.title || "—"}</span>,
      },
      {
        key: "form_date",
        label: "Date",
        value: (r) => (r.form_date ? String(r.form_date) : ""),
        render: (r) => formatDate(r.form_date),
      },
      {
        key: "item_count",
        label: "Articles",
        align: "right",
        value: (r) => r.item_count,
        render: (r) => (
          <span className="inline-flex min-w-[1.75rem] justify-center rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-semibold text-brand-400">
            {r.item_count}
          </span>
        ),
      },
      ...creatorColumns<KfcFormRow>(),
      signedByColumn<KfcFormRow>(),
      {
        key: "created_at",
        label: "Submitted On",
        value: (r) => (r.created_at ? String(r.created_at) : ""),
        render: (r) => (
          <span className="whitespace-nowrap text-muted">{formatDateTime(r.created_at)}</span>
        ),
      },
      {
        key: "_actions",
        label: "Actions",
        align: "right",
        className: "w-24",
        render: (r) => (
          <TableActions>
            <TableAction
              tone="edit"
              icon={Pencil}
              href={`/report/kfc-form-13/${r.id}/edit`}
              title="Edit / print"
            />
            <TableAction
              tone="delete"
              icon={Trash2}
              onClick={() => remove(r)}
              disabled={deleting === r.id}
              title="Delete"
            />
          </TableActions>
        ),
      },
    ],
    [deleting]
  );

  return (
    <DataTable
      title="K.F.C. Form 13"
      subtitle={`${rows.length} saved forms`}
      columns={columns}
      rows={rows}
    />
  );
}
