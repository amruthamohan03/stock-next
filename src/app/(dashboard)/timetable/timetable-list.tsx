"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete } from "@/lib/api-client";
import { Eye, Pencil, Trash2 } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import { TableAction, TableActions } from "@/components/ui/table-action";

export type TimetableRow = {
  id: number;
  title: string | null;
  semester: string | null;
  scheme: string | null;
  academic_year: string | null;
  department_name: string | null;
};

export default function TimetableList({ rows }: { rows: TimetableRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = async (row: TimetableRow) => {
    const ok = await confirm({
      title: `Delete "${row.title ?? row.id}"?`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(row.id);
    const result = await apiDelete(`/api/timetable?id=${row.id}`);
    setDeleting(null);
    if (toast.fromResult(result, { success: "Timetable deleted" })) router.refresh();
  };

  const columns: Column<TimetableRow>[] = useMemo(
    () => [
      { key: "_sl", label: "#", className: "w-12 text-faint", render: (_r, i) => i + 1 },
      {
        key: "title",
        label: "Title",
        value: (r) => r.title,
        render: (r) => <span className="font-medium text-fg">{r.title || "—"}</span>,
      },
      { key: "department_name", label: "Department", value: (r) => r.department_name },
      { key: "semester", label: "Semester", value: (r) => r.semester },
      { key: "scheme", label: "Scheme", value: (r) => r.scheme },
      { key: "academic_year", label: "Academic Year", value: (r) => r.academic_year },
      {
        key: "_actions",
        label: "Actions",
        align: "right",
        className: "w-28",
        render: (r) => (
          <TableActions>
            <TableAction tone="view" icon={Eye} href={`/timetable/${r.id}`} title="View / print" />
            <TableAction tone="edit" icon={Pencil} href={`/timetable/${r.id}/edit`} title="Edit" />
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

  return <DataTable title="Timetables" subtitle={`${rows.length} saved`} columns={columns} rows={rows} />;
}
