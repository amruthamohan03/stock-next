"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Pagination } from "@/components/ui/pagination";
import { Modal } from "@/components/ui/modal";

const PAGE_SIZE = 10;

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "select" | "password" | "email";
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
    const res = await fetch(`/api/masters/${apiKey}`, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      setOpen(false);
      router.refresh();
    } else {
      setError(json.message ?? "Something went wrong");
    }
  };

  const remove = async (row: Row) => {
    if (!confirm(`Delete this record? This can be undone in the database.`)) return;
    const res = await fetch(`/api/masters/${apiKey}?id=${row.id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (json.success) router.refresh();
    else alert(json.message ?? "Delete failed");
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3 font-semibold">#</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-5 py-3 font-semibold">
                    {c.label}
                  </th>
                ))}
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} className="px-5 py-8 text-center text-slate-400">
                    No records found.
                  </td>
                </tr>
              )}
              {pageRows.map((row, i) => (
                <tr key={String(row.id)} className="border-b border-slate-50 transition-colors hover:bg-brand-50/40">
                  <td className="px-5 py-3 text-slate-400">
                    {(current - 1) * PAGE_SIZE + i + 1}
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className="px-5 py-3 text-slate-700">
                      {c.badge ? (
                        <Badge value={String(row[c.key] ?? "")} />
                      ) : (
                        String(row[c.key] ?? "—")
                      )}
                    </td>
                  ))}
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(row)}
                        className="text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
      >
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {fields.map((f) => (
            <div key={f.name}>
              <Label htmlFor={f.name}>
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </Label>
              {f.type === "select" ? (
                <SearchableSelect
                  id={f.name}
                  value={form[f.name] ?? ""}
                  options={f.options ?? []}
                  onChange={(v) => setForm({ ...form, [f.name]: v })}
                />
              ) : f.type === "textarea" ? (
                <textarea
                  id={f.name}
                  value={form[f.name] ?? ""}
                  required={f.required}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
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
                          : "text"
                  }
                  placeholder={f.placeholder}
                  value={form[f.name] ?? ""}
                  required={f.required}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function Badge({ value }: { value: string }) {
  const v = value.toUpperCase();
  const map: Record<string, string> = {
    Y: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    N: "bg-slate-100 text-slate-500 ring-slate-500/20",
    C: "bg-brand-50 text-brand-700 ring-brand-600/20",
    PUBLIC: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
    PRIVATE: "bg-amber-50 text-amber-700 ring-amber-600/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        map[v] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"
      }`}
    >
      {value || "—"}
    </span>
  );
}
