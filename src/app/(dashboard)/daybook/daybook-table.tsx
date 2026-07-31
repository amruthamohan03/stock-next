"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2 } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { formatDate } from "@/lib/utils";

export type DaybookRow = {
  id: number;
  page_no: string | null;
  stockbook_name: string | null;
  document_date: string | Date | null;
  provider_name: string | null;
  issued_to_name: string | null;
  invoice_ref: string | null;
  receipt_lines: number;
  issue_lines: number;
  total_receipt_amt: number;
  total_issue_amt: number;
  verifier_name: string | null;
};

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DaybookTable({ rows }: { rows: DaybookRow[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = async (row: DaybookRow) => {
    if (!confirm(`Delete this Day Book entry? All receipt and issue lines will also be removed.`)) return;
    setDeleting(row.id);
    const res = await fetch(`/api/daybook?id=${row.id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(null);
    if (json.success) router.refresh();
    else alert(json.message ?? "Delete failed");
  };

  const columns: Column<DaybookRow>[] = useMemo(
    () => [
      { key: "_sl", label: "#", className: "w-12 text-faint", render: (_r, i) => i + 1 },
      {
        key: "page_no",
        label: "Page",
        value: (r) => r.page_no,
        render: (r) => (
          <span className="rounded-md bg-slate-500/15 px-2 py-0.5 text-xs font-medium text-muted">
            {r.page_no || "—"}
          </span>
        ),
      },
      { key: "stockbook_name", label: "Stockbook", value: (r) => r.stockbook_name },
      {
        key: "document_date",
        label: "Date",
        value: (r) => (r.document_date ? String(r.document_date) : ""),
        render: (r) => <span className="whitespace-nowrap">{formatDate(r.document_date)}</span>,
      },
      {
        key: "provider_name",
        label: "Provider",
        value: (r) => r.provider_name,
        render: (r) => <span className="font-medium text-fg">{r.provider_name || "—"}</span>,
      },
      { key: "issued_to_name", label: "Issued To", value: (r) => r.issued_to_name },
      { key: "invoice_ref", label: "Invoice Ref", value: (r) => r.invoice_ref },
      {
        key: "receipt_lines",
        label: "Rcpt",
        align: "right",
        value: (r) => r.receipt_lines,
        render: (r) => (
          <span className="inline-flex min-w-[1.75rem] justify-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-500">
            {r.receipt_lines}
          </span>
        ),
      },
      {
        key: "issue_lines",
        label: "Issue",
        align: "right",
        value: (r) => r.issue_lines,
        render: (r) => (
          <span className="inline-flex min-w-[1.75rem] justify-center rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-500">
            {r.issue_lines}
          </span>
        ),
      },
      {
        key: "total_receipt_amt",
        label: "Receipt (Rs.)",
        align: "right",
        value: (r) => r.total_receipt_amt,
        render: (r) => <span className="font-semibold text-emerald-600">{inr(r.total_receipt_amt)}</span>,
      },
      {
        key: "total_issue_amt",
        label: "Issue (Rs.)",
        align: "right",
        value: (r) => r.total_issue_amt,
        render: (r) => <span className="font-semibold text-rose-600">{inr(r.total_issue_amt)}</span>,
      },
      { key: "verifier_name", label: "Verifier", value: (r) => r.verifier_name },
      {
        key: "_actions",
        label: "Actions",
        align: "right",
        className: "w-28",
        render: (r) => (
          <TableActions>
            <TableAction tone="view" icon={Eye} href={`/daybook/${r.id}`} title="View entry" />
            <TableAction tone="edit" icon={Pencil} href={`/daybook/${r.id}/edit`} title="Edit entry" />
            <TableAction
              tone="delete"
              icon={Trash2}
              onClick={() => remove(r)}
              disabled={deleting === r.id}
              title="Delete entry"
            />
          </TableActions>
        ),
      },
    ],
    [deleting]
  );

  return (
    <DataTable
      title="Day Book Entries"
      subtitle={`${rows.length} entries`}
      columns={columns}
      rows={rows}
      minWidth="80rem"
    />
  );
}
