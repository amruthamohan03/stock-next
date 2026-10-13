"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2, Paperclip } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import CardGrid from "@/components/card-grid";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import {
  MATERIAL_TYPE_TINT,
  materialTypeLabel,
  toMaterialType,
} from "@/lib/study-material";
import StudyMaterialCard from "./study-material-card";

export type MaterialRow = {
  id: number;
  title: string | null;
  material_type: string | null;
  semester: string | null;
  scheme: string | null;
  academic_year: string | null;
  exam_session: string | null;
  module_no: string | null;
  created_at: string | Date | null;
  subject_name: string | null;
  subject_code: string | null;
  department_name: string | null;
  uploader_name: string | null;
  file_count: number;
};

export default function StudyMaterialList({
  rows,
  actions,
}: {
  rows: MaterialRow[];
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = async (row: MaterialRow) => {
    const ok = await confirm({
      title: `Delete "${row.title ?? row.id}"?`,
      description: "It is soft-deleted, so it can be restored in the database.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(row.id);
    const result = await apiDelete(`/api/masters/study-material?id=${row.id}`);
    setDeleting(null);
    if (toast.fromResult(result, { success: "Material deleted" })) router.refresh();
  };

  const columns: Column<MaterialRow>[] = useMemo(
    () => [
      { key: "_sl", label: "#", className: "w-12 text-faint", render: (_r, i) => i + 1 },
      {
        key: "title",
        label: "Title",
        value: (r) => r.title,
        render: (r) => <span className="font-medium text-fg">{r.title || "—"}</span>,
      },
      {
        key: "material_type",
        label: "Type",
        value: (r) => materialTypeLabel(r.material_type),
        render: (r) => (
          <span
            className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
              MATERIAL_TYPE_TINT[toMaterialType(r.material_type)]
            }`}
          >
            {materialTypeLabel(r.material_type)}
          </span>
        ),
      },
      {
        key: "subject",
        label: "Subject",
        value: (r) => `${r.subject_code ?? ""} ${r.subject_name ?? ""}`,
        render: (r) => (
          <div className="min-w-0">
            <div className="truncate text-sm text-fg">{r.subject_name || "—"}</div>
            {r.subject_code && <div className="text-xs text-muted">{r.subject_code}</div>}
          </div>
        ),
      },
      { key: "semester", label: "Sem", value: (r) => r.semester ?? "" },
      { key: "academic_year", label: "Year", value: (r) => r.academic_year ?? "" },
      { key: "department_name", label: "Department", value: (r) => r.department_name ?? "" },
      {
        key: "file_count",
        label: "Files",
        align: "right",
        className: "w-16",
        value: (r) => String(r.file_count),
        render: (r) => (
          <span
            className={`inline-flex items-center gap-1 tabular-nums ${
              r.file_count ? "text-muted" : "text-faint"
            }`}
          >
            <Paperclip className="h-3.5 w-3.5" /> {r.file_count}
          </span>
        ),
      },
      {
        key: "created_at",
        label: "Added",
        value: (r) => (r.created_at ? String(r.created_at) : ""),
        render: (r) => (
          <span className="whitespace-nowrap text-muted">{formatDate(r.created_at)}</span>
        ),
      },
      {
        key: "_actions",
        label: "Actions",
        align: "right",
        className: "w-32",
        render: (r) => (
          <TableActions>
            <TableAction tone="view" icon={Eye} href={`/study-material/${r.id}`} title="Open" />
            <TableAction
              tone="edit"
              icon={Pencil}
              href={`/study-material/${r.id}/edit`}
              title="Edit"
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deleting]
  );

  return (
    <CardGrid
      title="Study Materials"
      subtitle="Lab manuals, notes, previous question papers and other material by subject"
      rows={rows}
      searchText={(r) =>
        [
          r.title,
          materialTypeLabel(r.material_type),
          r.subject_name,
          r.subject_code,
          r.department_name,
          r.semester,
          r.academic_year,
          r.exam_session,
          r.module_no,
          r.uploader_name,
        ]
          .filter(Boolean)
          .join(" ")
      }
      card={(r) => <StudyMaterialCard row={r} />}
      actions={actions}
      facets={[
        { label: "Academic year", value: (r) => r.academic_year },
        { label: "Type", value: (r) => materialTypeLabel(r.material_type), sort: "asc" },
        { label: "Semester", value: (r) => r.semester, sort: "asc" },
      ]}
      emptyState="No study materials yet — add the first one."
      table={<DataTable title="Study Materials" columns={columns} rows={rows} />}
    />
  );
}
