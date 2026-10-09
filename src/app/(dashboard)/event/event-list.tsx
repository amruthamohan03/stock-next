"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2, CalendarDays } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import CardGrid from "@/components/card-grid";
import EventCard from "./event-card";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { eventStatusLabel, isEventLocked, toEventStatus } from "@/lib/event-status";

export type EventRow = {
  id: number;
  name: string | null;
  subtitle: string | null;
  academic_year: string | null;
  start_date: string | Date | null;
  end_date: string | Date | null;
  venue: string | null;
  status: string | null;
  committee_name: string | null;
  item_count: number;
  on_stage_count: number;
  off_stage_count: number;
  participant_count: number;
  file_count: number;
};

export default function EventList({
  rows,
  actions,
}: {
  rows: EventRow[];
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = async (row: EventRow) => {
    if (isEventLocked(row.status)) {
      toast.warning({
        title: "This event is finalised",
        description: "Reopen it before deleting.",
      });
      return;
    }
    const ok = await confirm({
      title: `Delete "${row.name ?? row.id}"?`,
      description: "Its items, duty list and participants go with it.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(row.id);
    const result = await apiDelete(`/api/event?id=${row.id}`);
    setDeleting(null);
    if (toast.fromResult(result, { success: "Event deleted" })) router.refresh();
  };

  const columns: Column<EventRow>[] = useMemo(
    () => [
      { key: "_sl", label: "#", className: "w-12 text-faint", render: (_r, i) => i + 1 },
      {
        key: "name",
        label: "Event",
        value: (r) => `${r.name ?? ""} ${r.subtitle ?? ""}`,
        render: (r) => (
          <div className="min-w-0">
            <div className="font-medium text-fg">{r.name || "—"}</div>
            {r.subtitle && <div className="text-xs text-muted">{r.subtitle}</div>}
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        value: (r) => eventStatusLabel(r.status),
        render: (r) => (
          <StatusBadge
            status={toEventStatus(r.status) === "FINALISED" ? "SUBMITTED" : "DRAFT"}
            label={eventStatusLabel(r.status)}
          />
        ),
      },
      { key: "committee_name", label: "Committee", value: (r) => r.committee_name ?? "" },
      { key: "academic_year", label: "Year", value: (r) => r.academic_year ?? "" },
      {
        key: "dates",
        label: "Dates",
        value: (r) => String(r.start_date ?? ""),
        render: (r) =>
          r.start_date ? (
            <span className="whitespace-nowrap text-muted">
              {formatDate(r.start_date)}
              {r.end_date && String(r.end_date) !== String(r.start_date)
                ? ` – ${formatDate(r.end_date)}`
                : ""}
            </span>
          ) : (
            <span className="text-faint">—</span>
          ),
      },
      {
        key: "item_count",
        label: "Items",
        align: "right",
        className: "w-16",
        value: (r) => String(r.item_count),
        render: (r) => <span className="tabular-nums text-muted">{r.item_count}</span>,
      },
      {
        key: "_actions",
        label: "Actions",
        align: "right",
        className: "w-40",
        render: (r) => (
          <TableActions>
            <TableAction tone="view" icon={Eye} href={`/event/${r.id}`} title="Open" />
            <TableAction
              tone="neutral"
              icon={CalendarDays}
              href={`/event/${r.id}/duty`}
              title="Duty list"
            />
            {!isEventLocked(r.status) && (
              <TableAction tone="edit" icon={Pencil} href={`/event/${r.id}/edit`} title="Edit" />
            )}
            {!isEventLocked(r.status) && (
              <TableAction
                tone="delete"
                icon={Trash2}
                onClick={() => remove(r)}
                disabled={deleting === r.id}
                title="Delete"
              />
            )}
          </TableActions>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deleting]
  );

  return (
    <CardGrid
      title="Events"
      subtitle="Arts festivals and other committee events"
      rows={rows}
      searchText={(r) =>
        [r.name, r.subtitle, r.committee_name, r.academic_year, r.venue]
          .filter(Boolean)
          .join(" ")
      }
      card={(r) => <EventCard row={r} />}
      actions={actions}
      facet={{ label: "Academic year", value: (r) => r.academic_year }}
      emptyState="No events yet — create the first one."
      table={<DataTable title="Events" columns={columns} rows={rows} />}
    />
  );
}
