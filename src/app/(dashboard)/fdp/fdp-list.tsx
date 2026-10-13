"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2, Paperclip, Award } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import CardGrid from "@/components/card-grid";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { FDP_MODE_TINT, durationLabel, fdpModeLabel, toFdpMode } from "@/lib/fdp";
import FdpCard from "./fdp-card";

export type FdpRow = {
  id: number;
  title: string | null;
  faculty_name: string | null;
  staff_name: string | null;
  organizer: string | null;
  mode: string | null;
  start_date: string | Date | null;
  end_date: string | Date | null;
  academic_year: string | null;
  topics: string | null;
  subject_name: string | null;
  department_name: string | null;
  file_count: number;
  has_certificate: boolean;
};

export default function FdpList({
  rows,
  actions,
}: {
  rows: FdpRow[];
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = async (row: FdpRow) => {
    const ok = await confirm({
      title: `Delete "${row.title ?? row.id}"?`,
      description: "It is soft-deleted, so it can be restored in the database.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(row.id);
    const result = await apiDelete(`/api/masters/fdp?id=${row.id}`);
    setDeleting(null);
    if (toast.fromResult(result, { success: "FDP record deleted" })) router.refresh();
  };

  const columns: Column<FdpRow>[] = useMemo(
    () => [
      { key: "_sl", label: "#", className: "w-12 text-faint", render: (_r, i) => i + 1 },
      {
        key: "title",
        label: "Programme",
        value: (r) => `${r.title ?? ""} ${r.organizer ?? ""}`,
        render: (r) => (
          <div className="min-w-0">
            <div className="font-medium text-fg">{r.title || "—"}</div>
            {r.organizer && <div className="text-xs text-muted">{r.organizer}</div>}
          </div>
        ),
      },
      {
        key: "faculty",
        label: "Faculty",
        value: (r) => r.faculty_name ?? r.staff_name ?? "",
        render: (r) => r.faculty_name || r.staff_name || <span className="text-faint">—</span>,
      },
      {
        key: "mode",
        label: "Mode",
        value: (r) => fdpModeLabel(r.mode),
        render: (r) => (
          <span
            className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
              FDP_MODE_TINT[toFdpMode(r.mode)]
            }`}
          >
            {fdpModeLabel(r.mode)}
          </span>
        ),
      },
      {
        key: "dates",
        label: "Dates",
        value: (r) => String(r.start_date ?? ""),
        render: (r) =>
          r.start_date ? (
            <div className="min-w-0">
              <div className="whitespace-nowrap text-sm text-fg">
                {formatDate(r.start_date)}
                {r.end_date && String(r.end_date) !== String(r.start_date)
                  ? ` – ${formatDate(r.end_date)}`
                  : ""}
              </div>
              <div className="text-xs text-muted">{durationLabel(r.start_date, r.end_date)}</div>
            </div>
          ) : (
            <span className="text-faint">—</span>
          ),
      },
      { key: "academic_year", label: "Year", value: (r) => r.academic_year ?? "" },
      { key: "subject_name", label: "Subject", value: (r) => r.subject_name ?? "" },
      {
        key: "file_count",
        label: "Files",
        align: "right",
        className: "w-20",
        value: (r) => String(r.file_count),
        render: (r) => (
          <span className="inline-flex items-center justify-end gap-1.5">
            {r.has_certificate && <Award className="h-3.5 w-3.5 text-amber-500" />}
            <span className={`tabular-nums ${r.file_count ? "text-muted" : "text-faint"}`}>
              <Paperclip className="mr-1 inline h-3.5 w-3.5" />
              {r.file_count}
            </span>
          </span>
        ),
      },
      {
        key: "_actions",
        label: "Actions",
        align: "right",
        className: "w-32",
        render: (r) => (
          <TableActions>
            <TableAction tone="view" icon={Eye} href={`/fdp/${r.id}`} title="Open" />
            <TableAction tone="edit" icon={Pencil} href={`/fdp/${r.id}/edit`} title="Edit" />
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
      title="Faculty Development"
      subtitle="FDPs, workshops and training attended by staff"
      rows={rows}
      searchText={(r) =>
        [
          r.title,
          r.organizer,
          r.faculty_name,
          r.staff_name,
          fdpModeLabel(r.mode),
          r.academic_year,
          r.subject_name,
          r.department_name,
          r.topics,
        ]
          .filter(Boolean)
          .join(" ")
      }
      card={(r) => <FdpCard row={r} />}
      actions={actions}
      facets={[
        { label: "Academic year", value: (r) => r.academic_year },
        { label: "Mode", value: (r) => fdpModeLabel(r.mode), sort: "asc" },
      ]}
      emptyState="No FDP records yet — add the first one."
      table={<DataTable title="Faculty Development" columns={columns} rows={rows} />}
    />
  );
}
