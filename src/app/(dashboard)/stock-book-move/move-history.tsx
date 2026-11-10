"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Undo2 } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete, apiPut } from "@/lib/api-client";

export type MoveRow = {
  id: number;
  source_type: string;
  action: string;
  moved_date: string;
  indent_no: string | null;
  indent_date: string | null;
  item_name: string | null;
  qty_moved: number;
  from_book: string | null;
  from_page: number | null;
  to_book: string | null;
  to_page: number | null;
  /** Set when indent items were moved to an indent in another indent book. */
  indent_book: string | null;
  to_indent_no: string | null;
  to_indent_date: string | null;
  to_indent_book: string | null;
  moved_by_id: number;
  moved_by: string | null;
  remarks: string | null;
};

/** A place a line was moved from or to: a book name over its page or indent. */
type Place = { title: string; detail: string | null } | null;

const indentMove = (r: MoveRow) => r.to_indent_no !== null;
const indentDetail = (no: string | null, date: string | null) =>
  `Indent No ${no ?? "—"}${date ? ` · ${formatDate(date)}` : ""}`;

const fromPlace = (r: MoveRow): Place =>
  indentMove(r)
    ? { title: r.indent_book ?? "Indent book", detail: indentDetail(r.indent_no, r.indent_date) }
    : r.from_book
      ? { title: r.from_book, detail: r.from_page != null ? `Page No: ${r.from_page}` : null }
      : null;

const toPlace = (r: MoveRow): Place =>
  indentMove(r)
    ? { title: r.to_indent_book ?? "Indent book", detail: indentDetail(r.to_indent_no, r.to_indent_date) }
    : r.to_book
      ? { title: r.to_book, detail: r.to_page != null ? `Page No: ${r.to_page}` : null }
      : null;

const placeText = (p: Place, empty: string) => (p ? [p.title, p.detail].filter(Boolean).join(" · ") : empty);
const fromText = (r: MoveRow) => placeText(fromPlace(r), "No stock book");
const toText = (r: MoveRow) =>
  r.action === "REMOVE" ? "Removed from stock book" : placeText(toPlace(r), "No stock book");

/** Book name over its page or indent, which keeps the From/To columns narrow. */
function PlaceCell({ place, empty }: { place: Place; empty: string }) {
  if (!place) return <span className="text-faint">{empty}</span>;
  return (
    <div>
      <span className="block text-fg">{place.title}</span>
      {place.detail && <span className="block text-xs text-faint">{place.detail}</span>}
    </div>
  );
}

const typeText = (r: MoveRow) =>
  r.source_type === "STOCK" ? "Stock entry" : indentMove(r) ? "Indent → indent book" : "Indent entry";

export default function MoveHistory({
  rows,
  users,
}: {
  rows: MoveRow[];
  users: { id: number; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<number | null>(null);
  const [editing, setEditing] = useState<MoveRow | null>(null);
  const [form, setForm] = useState({ moved_date: "", moved_by: "", remarks: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const userOpts = useMemo(
    () => users.map((u) => ({ value: String(u.id), label: u.name })),
    [users]
  );

  const openEdit = (r: MoveRow) => {
    setForm({ moved_date: r.moved_date, moved_by: String(r.moved_by_id), remarks: r.remarks ?? "" });
    setError(null);
    setEditing(r);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const result = await apiPut("/api/stock-book-move", { id: editing.id, ...form });
    setSaving(false);
    if (result.success) {
      setEditing(null);
      toast.success(result.message);
      router.refresh();
    } else {
      // Kept in the dialog, beside the field to fix.
      setError(result.message);
    }
  };

  const undo = async (r: MoveRow) => {
    const back = fromText(r);
    const ok = await confirm({
      title: `Delete this ${r.action === "REMOVE" ? "removal" : "move"}?`,
      description: `It is undone: ${r.qty_moved} × ${r.item_name ?? "item"} goes back to ${back}.`,
      confirmLabel: "Delete & undo",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(r.id);
    const result = await apiDelete(`/api/stock-book-move?id=${r.id}`);
    setBusy(null);
    if (toast.fromResult(result)) router.refresh();
  };

  const columns: Column<MoveRow>[] = useMemo(
    () => [
      { key: "_sl", label: "#", className: "w-12 text-faint", render: (_r, i) => i + 1 },
      {
        key: "moved_date",
        label: "Date",
        value: (r) => formatDate(r.moved_date),
        className: "whitespace-nowrap",
      },
      {
        key: "indent",
        label: "Indent No / Date",
        value: (r) => `${r.indent_no ?? ""} ${r.indent_date ? formatDate(r.indent_date) : ""}`,
        render: (r) => (
          <div>
            <span className="block font-medium text-fg">{r.indent_no ?? "—"}</span>
            <span className="block text-xs text-faint">
              {r.indent_date ? formatDate(r.indent_date) : "—"}
            </span>
          </div>
        ),
      },
      {
        key: "action",
        label: "Action / Type",
        value: (r) => `${r.action === "REMOVE" ? "Remove" : "Move"} ${typeText(r)}`,
        render: (r) => (
          <div className="space-y-1">
            <Badge value={r.action} label={r.action === "REMOVE" ? "Remove" : "Move"} dot />
            <span className="block whitespace-nowrap text-xs text-faint">{typeText(r)}</span>
          </div>
        ),
      },
      { key: "item_name", label: "Item", value: (r) => r.item_name },
      { key: "qty_moved", label: "Qty", align: "right", value: (r) => r.qty_moved },
      {
        key: "from",
        label: "From",
        value: (r) => fromText(r),
        render: (r) => <PlaceCell place={fromPlace(r)} empty="No stock book" />,
      },
      {
        key: "to",
        label: "To",
        value: (r) => toText(r),
        render: (r) =>
          r.action === "REMOVE" ? (
            <span className="text-faint">Removed from stock book</span>
          ) : (
            <PlaceCell place={toPlace(r)} empty="No stock book" />
          ),
      },
      { key: "moved_by", label: "Done By", value: (r) => r.moved_by },
      {
        key: "remarks",
        label: "Remarks",
        value: (r) => r.remarks,
        render: (r) => <span className="line-clamp-2 max-w-[12rem]">{r.remarks || "—"}</span>,
      },
      {
        key: "_actions",
        label: "Actions",
        align: "right",
        className: "w-24",
        render: (r) => (
          <TableActions>
            <TableAction tone="edit" icon={Pencil} onClick={() => openEdit(r)} title="Edit details" />
            <TableAction
              tone="delete"
              icon={Undo2}
              onClick={() => undo(r)}
              disabled={busy === r.id}
              title="Delete (undo this move)"
            />
          </TableActions>
        ),
      },
    ],
    // openEdit/undo only close over stable hooks and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy]
  );

  return (
    <>
      <DataTable
        title="Stock Book Moves & Removals"
        subtitle={`${rows.length} ${rows.length === 1 ? "record" : "records"}`}
        columns={columns}
        rows={rows}
        minWidth="66rem"
      />

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.action === "REMOVE" ? "Removal" : "Move"}`}
        size="lg"
      >
        {editing && (
          <form onSubmit={save} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
                {error}
              </div>
            )}
            <p className="rounded-lg bg-elevated px-3 py-2 text-sm text-muted ring-1 ring-line">
              {editing.qty_moved} × <span className="font-medium text-fg">{editing.item_name}</span>
              {" · "}
              {fromText(editing)} → {toText(editing)}
              <span className="mt-1 block text-xs text-faint">
                The books can&apos;t be changed here. To change them, delete this record (which
                undoes it) and make a new one.
              </span>
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="edit-date">
                  Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={form.moved_date}
                  onChange={(e) => setForm((f) => ({ ...f, moved_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-by">
                  Done By <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  id="edit-by"
                  value={form.moved_by}
                  onChange={(v) => setForm((f) => ({ ...f, moved_by: v }))}
                  options={userOpts}
                  placeholder="Choose a user"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="edit-remarks">Remarks</Label>
                <Input
                  id="edit-remarks"
                  maxLength={255}
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
