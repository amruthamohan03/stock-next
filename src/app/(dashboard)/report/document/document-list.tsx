"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { creatorColumns, signedByColumn } from "@/components/table-columns";
import { formatDate } from "@/lib/utils";

export type DocumentRow = {
  id: number;
  title: string | null;
  doc_type: string | null;
  doc_date: string | Date | null;
  created_by_name: string | null;
  role_name: string | null;
  signed_by_name: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  submission: "Submission",
  justification: "Justification",
  essentiality: "Essentiality",
  custom: "Custom",
};

export default function DocumentList({ rows }: { rows: DocumentRow[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = async (row: DocumentRow) => {
    if (!confirm(`Delete "${row.title ?? row.id}"?`)) return;
    setDeleting(row.id);
    const res = await fetch(`/api/document?id=${row.id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(null);
    if (json.success) router.refresh();
    else alert(json.message ?? "Delete failed");
  };

  const columns: Column<DocumentRow>[] = useMemo(
    () => [
      { key: "_sl", label: "#", className: "w-12 text-faint", render: (_r, i) => i + 1 },
      {
        key: "title",
        label: "Title",
        value: (r) => r.title,
        render: (r) => <span className="font-medium text-fg">{r.title || "—"}</span>,
      },
      {
        key: "doc_type",
        label: "Type",
        value: (r) => (r.doc_type ? TYPE_LABEL[r.doc_type] ?? r.doc_type : ""),
        render: (r) => (
          <span className="inline-flex rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-medium text-brand-400">
            {r.doc_type ? TYPE_LABEL[r.doc_type] ?? r.doc_type : "—"}
          </span>
        ),
      },
      {
        key: "doc_date",
        label: "Date",
        value: (r) => (r.doc_date ? String(r.doc_date) : ""),
        render: (r) => formatDate(r.doc_date),
      },
      ...creatorColumns<DocumentRow>(),
      signedByColumn<DocumentRow>(),
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
              href={`/report/document/${r.id}/edit`}
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
      title="Documents"
      subtitle={`${rows.length} saved documents`}
      columns={columns}
      rows={rows}
    />
  );
}
