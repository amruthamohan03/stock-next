"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Pagination } from "@/components/ui/pagination";
import { Modal } from "@/components/ui/modal";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete, apiRequest } from "@/lib/api-client";

const PAGE_SIZE = 10;

/** Split a stored "1,3" value into its parts. */
function csvParts(csv: string): string[] {
  return csv.split(",").map((v) => v.trim()).filter(Boolean);
}

/**
 * Add or remove one value from a comma-separated list, keeping the order of
 * `order` so the stored string does not depend on the order of clicks.
 */
export function toggleCsv(csv: string, value: string, order: string[]): string {
  const cur = csvParts(csv);
  const next = cur.includes(value) ? cur.filter((c) => c !== value) : [...cur, value];
  return order.filter((o) => next.includes(o)).join(",");
}

export type FieldDef = {
  name: string;
  label: string;
  /** "multiselect" stores the chosen option values comma separated in one column. */
  type?:
    | "text"
    | "number"
    | "textarea"
    | "select"
    | "multiselect"
    | "password"
    | "email"
    | "date";
  required?: boolean;
  options?: { value: string | number; label: string }[];
  default?: string | number;
  placeholder?: string;
};

export type ColumnDef = {
  key: string;
  label: string;
  /** Render a colored badge for enum-ish values. */
  badge?: boolean;
};

type Row = Record<string, unknown>;

export default function CrudTable({
  apiKey,
  title,
  columns,
  rows,
  fields,
}: {
  apiKey: string;
  title: string;
  columns: ColumnDef[];
  rows: Row[];
  fields: FieldDef[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const openAdd = () => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.name] = String(f.default ?? "");
    setForm(init);
    setEditing(null);
    setError(null);
    setOpen(true);
  };

  const openEdit = (row: Row) => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.name] = row[f.name] == null ? "" : String(row[f.name]);
    setForm(init);
    setEditing(row);
    setError(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Required selects are custom controls, so validate them ourselves.
    const missing = fields.find(
      (f) => f.required && !String(form[f.name] ?? "").trim()
    );
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = { ...form };
    if (editing) payload.id = editing.id;
    const result = await apiRequest(`/api/masters/${apiKey}`, {
      method: editing ? "PUT" : "POST",
      body: payload,
    });
    setSaving(false);
    if (result.success) {
      setOpen(false);
      toast.success(result.message || (editing ? "Record updated" : "Record saved"));
      router.refresh();
    } else {
      // Errors stay in the dialog, beside the fields the user must fix.
      setError(result.message);
    }
  };

  const remove = async (row: Row) => {
    const ok = await confirm({
      title: "Delete this record?",
      description: "It is soft-deleted, so it can be restored in the database.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const result = await apiDelete(`/api/masters/${apiKey}?id=${row.id}`);
    if (toast.fromResult(result, { success: "Record deleted" })) router.refresh();
  };

  const filtered = rows.filter((r) =>
    search
      ? columns.some((c) =>
          String(r[c.key] ?? "").toLowerCase().includes(search.toLowerCase())
        )
      : true
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-8 w-40"
          />
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="data-grid">
            <thead>
              <tr>
                <th className="w-12">#</th>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2}>
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-elevated text-faint ring-1 ring-line">
                        <Inbox className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-medium text-muted">
                        {search ? "No matches for this search." : "Nothing here yet."}
                      </p>
                      <p className="text-xs text-faint">
                        {search
                          ? "Try a different term."
                          : "Use the Add button to create the first record."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {pageRows.map((row, i) => (
                <tr key={String(row.id)}>
                  <td className="num text-faint">{(current - 1) * PAGE_SIZE + i + 1}</td>
                  {columns.map((c) => (
                    <td key={c.key} className="text-fg">
                      {c.badge ? (
                        <Badge value={String(row[c.key] ?? "")} />
                      ) : (
                        String(row[c.key] ?? "—")
                      )}
                    </td>
                  ))}
                  <td>
                    <TableActions>
                      <TableAction tone="edit" icon={Pencil} onClick={() => openEdit(row)} title="Edit" />
                      <TableAction tone="delete" icon={Trash2} onClick={() => remove(row)} title="Delete" />
                    </TableActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={current}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPage={setPage}
        />
      </CardContent>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${title}` : `Add ${title}`}
        size="xl"
      >
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div
              key={f.name}
              className={f.type === "textarea" || f.type === "multiselect" ? "sm:col-span-2" : ""}
            >
              <Label htmlFor={f.name}>
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </Label>
              {f.type === "select" ? (
                <SearchableSelect
                  id={f.name}
                  value={form[f.name] ?? ""}
                  options={f.options ?? []}
                  onChange={(v) => setForm((prev) => ({ ...prev, [f.name]: v }))}
                />
              ) : f.type === "multiselect" ? (
                <MultiSelect
                  value={form[f.name] ?? ""}
                  options={f.options ?? []}
                  onToggle={(v) =>
                    setForm((prev) =>
                      // Chips are clicked in quick succession, so this must
                      // start from the latest value, not the rendered one.
                      ({
                        ...prev,
                        [f.name]: toggleCsv(
                          prev[f.name] ?? "",
                          v,
                          (f.options ?? []).map((o) => String(o.value))
                        ),
                      })
                    )
                  }
                />
              ) : f.type === "textarea" ? (
                <textarea
                  id={f.name}
                  value={form[f.name] ?? ""}
                  required={f.required}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [f.name]: e.target.value }))
                  }
                  className="w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg shadow-sm transition-colors placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  rows={3}
                />
              ) : (
                <Input
                  id={f.name}
                  type={
                    f.type === "number"
                      ? "number"
                      : f.type === "password"
                        ? "password"
                        : f.type === "email"
                          ? "email"
                          : f.type === "date"
                            ? "date"
                            : "text"
                  }
                  placeholder={f.placeholder}
                  value={form[f.name] ?? ""}
                  required={f.required}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [f.name]: e.target.value }))
                  }
                />
              )}
            </div>
          ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

/**
 * Pick several options, stored as one comma-separated string.
 *
 * Toggle chips rather than a native multiple <select>, which cannot be themed
 * and needs ctrl-click to work. The chip only reports which option was hit;
 * the caller folds it into the stored value with `toggleCsv`, so two quick
 * clicks in one render batch cannot lose each other.
 */
function MultiSelect({
  value,
  options,
  onToggle,
}: {
  value: string;
  options: { value: string | number; label: string }[];
  onToggle: (optionValue: string) => void;
}) {
  const chosen = csvParts(value);

  if (options.length === 0) {
    return <p className="py-1.5 text-sm text-faint">Nothing to choose from.</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 py-1">
      {options.map((o) => {
        const v = String(o.value);
        const on = chosen.includes(v);
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(v)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
              on
                ? "bg-accent-soft text-accent-fg ring-accent/40"
                : "bg-elevated text-muted ring-line hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
