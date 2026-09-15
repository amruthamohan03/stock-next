"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Paperclip, Eye, Printer, CheckCircle2, Send } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { creatorColumns, signedByColumn } from "@/components/table-columns";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete, apiPatch } from "@/lib/api-client";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  isLocked,
  nextActionLabel,
  nextStatus,
  statusLabel,
  toDocStatus,
} from "@/lib/document-status";

export type DocumentRow = {
  id: number;
  title: string | null;
  doc_type: string | null;
  doc_date: string | Date | null;
  created_at: string | Date | null;
  created_by_name: string | null;
  role_name: string | null;
  signed_by_name: string | null;
  has_attachment: boolean;
  status: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  submission: "Submission",
  justification: "Justification",
  essentiality: "Essentiality",
  custom: "Custom",
};

export default function DocumentList({ rows }: { rows: DocumentRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = async (row: DocumentRow) => {
    if (isLocked(row.status)) {
      toast.warning({
        title: "This document is final",
        description: "Reopen it before deleting.",
      });
      return;
    }
    const ok = await confirm({
      title: `Delete "${row.title ?? row.id}"?`,
      description: "It is soft-deleted, so it can be restored in the database.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(row.id);
    const result = await apiDelete(`/api/document?id=${row.id}`);
    setDeleting(null);
    if (toast.fromResult(result, { success: "Document deleted" })) router.refresh();
  };

  const [moving, setMoving] = useState<number | null>(null);

  const advance = async (row: DocumentRow) => {
    const to = nextStatus(row.status);
    if (!to) return;
    if (to === "SUBMITTED") {
      const ok = await confirm({
        title: `Submit "${row.title ?? row.id}"?`,
        description: "Once submitted the document is final and cannot be edited.",
        confirmLabel: "Submit",
      });
      if (!ok) return;
    }
    setMoving(row.id);
    const result = await apiPatch("/api/document", { id: row.id, status: to });
    setMoving(null);
    if (toast.fromResult(result, { error: "Could not change the status" })) router.refresh();
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
        key: "status",
        label: "Status",
        value: (r) => statusLabel(r.status),
        render: (r) => (
          <StatusBadge status={toDocStatus(r.status)} label={statusLabel(r.status)} />
        ),
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
        key: "created_at",
        label: "Submitted On",
        value: (r) => (r.created_at ? String(r.created_at) : ""),
        render: (r) => (
          <span className="whitespace-nowrap text-muted">{formatDateTime(r.created_at)}</span>
        ),
      },
      {
        key: "has_attachment",
        label: "File",
        align: "right",
        className: "w-14",
        value: (r) => (r.has_attachment ? "yes" : ""),
        render: (r) =>
          r.has_attachment ? (
            <Paperclip className="ml-auto h-4 w-4 text-accent" aria-label="Has attachment" />
          ) : (
            <span className="text-faint">—</span>
          ),
      },
      {
        key: "_actions",
        label: "Actions",
        align: "right",
        className: "w-56",
        render: (r) => {
          const to = nextStatus(r.status);
          const locked = isLocked(r.status);
          return (
            <TableActions>
              <TableAction
                tone="view"
                icon={Eye}
                href={`/report/document/${r.id}`}
                title="View"
              />
              <TableAction
                tone="neutral"
                icon={Printer}
                href={`/report/document/${r.id}?print=1`}
                title="Print"
              />
              {/* Verify at DRAFT, Submit at VERIFIED — one button, labelled by
                  the step it performs. Gone once the document is final. */}
              {to && (
                <TableAction
                  tone={to === "SUBMITTED" ? "edit" : "view"}
                  icon={to === "SUBMITTED" ? Send : CheckCircle2}
                  onClick={() => advance(r)}
                  disabled={moving === r.id}
                  title={nextActionLabel(r.status)}
                />
              )}
              {!locked && (
                <TableAction
                  tone="edit"
                  icon={Pencil}
                  href={`/report/document/${r.id}/edit`}
                  title="Edit"
                />
              )}
              {!locked && (
                <TableAction
                  tone="delete"
                  icon={Trash2}
                  onClick={() => remove(r)}
                  disabled={deleting === r.id}
                  title="Delete"
                />
              )}
            </TableActions>
          );
        },
      },
    ],
    [deleting, moving]
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
