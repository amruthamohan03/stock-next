"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2, Paperclip, Users } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import CardGrid from "@/components/card-grid";
import CommitteeCard from "./committee-card";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { COMMITTEE_TYPE_LABEL } from "@/lib/committee";

export type CommitteeRow = {
  id: number;
  name: string | null;
  committee_type: string | null;
  academic_year: string | null;
  order_no: string | null;
  order_date: string | Date | null;
  has_order: boolean;
  member_count: number;
  file_count: number;
  convenor: string | null;
  chairman: string | null;
  member_avatars: { name: string; role: string }[];
};

export default function CommitteeList({
  rows,
  actions,
}: {
  rows: CommitteeRow[];
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = async (row: CommitteeRow) => {
    const ok = await confirm({
      title: `Delete "${row.name ?? row.id}"?`,
      description: "It is soft-deleted, so it can be restored in the database.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(row.id);
    const result = await apiDelete(`/api/masters/committee?id=${row.id}`);
    setDeleting(null);
    if (toast.fromResult(result, { success: "Committee deleted" })) router.refresh();
  };

  const columns: Column<CommitteeRow>[] = useMemo(
    () => [
      { key: "_sl", label: "#", className: "w-12 text-faint", render: (_r, i) => i + 1 },
      {
        key: "name",
        label: "Committee",
        value: (r) => `${r.name ?? ""} ${r.convenor ?? ""} ${r.chairman ?? ""}`,
        render: (r) => (
          <div className="min-w-0">
            <div className="font-medium text-fg">{r.name || "—"}</div>
            {(r.convenor || r.chairman) && (
              <div className="text-xs text-muted">
                {r.convenor ? "Convenor" : "Chairman"}: {r.convenor ?? r.chairman}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "committee_type",
        label: "Type",
        value: (r) => COMMITTEE_TYPE_LABEL[r.committee_type ?? ""] ?? r.committee_type ?? "",
        render: (r) => (
          <span className="inline-flex rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-medium text-brand-400">
            {COMMITTEE_TYPE_LABEL[r.committee_type ?? ""] ?? r.committee_type ?? "—"}
          </span>
        ),
      },
      { key: "academic_year", label: "Year", value: (r) => r.academic_year ?? "" },
      {
        key: "order_no",
        label: "Order",
        value: (r) => r.order_no ?? "",
        render: (r) => (
          <div className="min-w-0">
            <div className="truncate text-sm text-fg">{r.order_no || "—"}</div>
            {r.order_date && (
              <div className="text-xs text-muted">{formatDate(r.order_date)}</div>
            )}
          </div>
        ),
      },
      {
        key: "member_count",
        label: "Members",
        align: "right",
        className: "w-20",
        value: (r) => String(r.member_count),
        render: (r) => (
          <span className="inline-flex items-center gap-1 tabular-nums text-muted">
            <Users className="h-3.5 w-3.5" /> {r.member_count}
          </span>
        ),
      },
      {
        key: "has_order",
        label: "File",
        align: "right",
        className: "w-14",
        value: (r) => (r.file_count ? "yes" : ""),
        render: (r) =>
          r.file_count ? (
            <span
              className={`ml-auto inline-flex items-center gap-1 text-xs ${r.has_order ? "text-accent" : "text-muted"}`}
              title={r.has_order ? "Appointment order uploaded" : "Files attached"}
            >
              <Paperclip className="h-3.5 w-3.5" /> {r.file_count}
            </span>
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
            <TableAction tone="view" icon={Eye} href={`/committee/${r.id}`} title="Open" />
            <TableAction tone="edit" icon={Pencil} href={`/committee/${r.id}/edit`} title="Edit" />
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deleting]
  );

  return (
    <CardGrid
      title="Committees"
      subtitle="Committees constituted in the institution, and the order that appointed each"
      rows={rows}
      searchText={(r) =>
        [r.name, r.committee_type, r.academic_year, r.order_no, r.convenor, r.chairman]
          .filter(Boolean)
          .join(" ")
      }
      card={(r) => <CommitteeCard row={r} />}
      actions={actions}
      facet={{ label: "Academic year", value: (r) => r.academic_year }}
      emptyState="No committees yet — create the first one."
      table={<DataTable title="Committees" columns={columns} rows={rows} />}
    />
  );
}
