"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, RotateCcw, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TableAction } from "@/components/ui/table-action";

export type Option = { id: number; name: string };
export type ModelOption = { id: number; name: string; make_id: number | null };

export type IndentInitial = {
  id: number;
  book_no: string;
  indent_no: string;
  item_type: string;
  indent_date: string;
  purpose: string;
  items: Omit<Row, "key">[];
};

type Row = {
  key: number;
  group_id: string;
  item_id: string;
  make_id: string;
  model_id: string;
  description: string;
  purpose: string;
  qty: string;
  remarks: string;
  sb_page: string;
  sb_vol: string;
  db_page: string;
  db_vol: string;
};

const blank = (key: number): Row => ({
  key,
  group_id: "",
  item_id: "",
  make_id: "",
  model_id: "",
  description: "",
  purpose: "",
  qty: "",
  remarks: "",
  sb_page: "",
  sb_vol: "",
  db_page: "",
  db_vol: "",
});

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function IndentForm({
  groups: initialGroups,
  items,
  makes,
  models,
  initial,
}: {
  groups: Option[];
  items: Option[];
  makes: Option[];
  models: ModelOption[];
  initial?: IndentInitial;
}) {
  const router = useRouter();
  const editing = !!initial;
  const keyRef = useState(() => ({ n: initial?.items.length ?? 1 }))[0];

  const [groups, setGroups] = useState<Option[]>(initialGroups);
  const [bookNo, setBookNo] = useState(initial?.book_no ?? "");
  const [indentNo, setIndentNo] = useState(initial?.indent_no ?? "");
  const [itemType, setItemType] = useState(initial?.item_type ?? "N");
  const [date, setDate] = useState(initial?.indent_date ?? todayIso());
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    initial && initial.items.length
      ? initial.items.map((it, i) => ({ key: i, ...it }))
      : [blank(0)]
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const groupOpts = useMemo(() => groups.map((g) => ({ value: g.id, label: g.name })), [groups]);
  const itemOpts = useMemo(() => items.map((i) => ({ value: i.id, label: i.name })), [items]);
  const makeOpts = useMemo(() => makes.map((m) => ({ value: m.id, label: m.name })), [makes]);

  const modelOptsFor = (makeId: string) =>
    models
      .filter((m) => !makeId || String(m.make_id ?? "") === makeId)
      .map((m) => ({ value: m.id, label: m.name }));

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, blank(keyRef.n++)]);
  const removeRow = (key: number) =>
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.key !== key)));

  const reset = () => {
    setBookNo("");
    setIndentNo("");
    setItemType("N");
    setDate(todayIso());
    setPurpose("");
    setRows([blank(keyRef.n++)]);
    setMsg(null);
  };

  const addGroup = async () => {
    const name = prompt("New group item name?")?.trim();
    if (!name) return;
    const res = await fetch("/api/masters/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_name: name, display: "Y" }),
    });
    const json = await res.json();
    if (json.success && json.data?.id) {
      setGroups((g) => [...g, { id: json.data.id, name }]);
    } else {
      alert(json.message ?? "Could not add group");
    }
  };

  const save = async () => {
    setMsg(null);
    if (!bookNo.trim() || !indentNo.trim() || !date) {
      setMsg({ ok: false, text: "Book No, Indent No and Date are required." });
      return;
    }
    const items = rows.filter((r) => r.item_id && Number(r.qty) > 0);
    if (items.length === 0) {
      setMsg({ ok: false, text: "Add at least one item with a quantity." });
      return;
    }
    setSaving(true);
    const res = await fetch("/api/indent", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: initial?.id,
        book_no: bookNo,
        indent_no: indentNo,
        item_type: itemType,
        indent_date: date,
        purpose,
        items: items.map((r) => ({
          group_id: r.group_id,
          item_id: r.item_id,
          make_id: r.make_id,
          model_id: r.model_id,
          description: r.description,
          purpose: r.purpose,
          qty: r.qty,
          remarks: r.remarks,
          sb_page: r.sb_page,
          sb_vol: r.sb_vol,
          db_page: r.db_page,
          db_vol: r.db_vol,
        })),
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      if (editing) {
        router.push("/indent");
        router.refresh();
      } else {
        setMsg({ ok: true, text: json.message });
        reset();
        router.refresh();
      }
    } else {
      setMsg({ ok: false, text: json.message ?? "Save failed" });
    }
  };

  const cell = "min-w-[9rem]";
  const numCell = "w-16";

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{editing ? `Edit Indent ${initial?.indent_no ?? ""}` : "Create New Indent"}</CardTitle>
          <p className="text-sm text-slate-400">Government Polytechnic College Nedumkandam</p>
        </div>
        {editing ? (
          <Button variant="outline" size="sm" onClick={() => router.push("/indent")}>
            Cancel
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {msg && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Header fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Book No <span className="text-red-500">*</span></Label>
            <Input type="number" value={bookNo} onChange={(e) => setBookNo(e.target.value)} />
          </div>
          <div>
            <Label>Indent No <span className="text-red-500">*</span></Label>
            <Input value={indentNo} onChange={(e) => setIndentNo(e.target.value)} />
          </div>
          <div>
            <Label>Item Type <span className="text-red-500">*</span></Label>
            <SearchableSelect
              value={itemType}
              onChange={setItemType}
              options={[
                { value: "N", label: "Non-Consumable" },
                { value: "C", label: "Consumable" },
              ]}
            />
          </div>
          <div>
            <Label>Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Purpose</Label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={2}
            placeholder="Please sanction the issue of the following materials for use in…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        {/* Items */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Items</h3>
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-2 font-semibold">Sl</th>
                <th className="px-2 py-2 font-semibold">Group</th>
                <th className="px-2 py-2 font-semibold">Item <span className="text-red-500">*</span></th>
                <th className="px-2 py-2 font-semibold">Make</th>
                <th className="px-2 py-2 font-semibold">Model</th>
                <th className="px-2 py-2 font-semibold">Description</th>
                <th className="px-2 py-2 font-semibold">Purpose</th>
                <th className="px-2 py-2 font-semibold">Qty <span className="text-red-500">*</span></th>
                <th className="px-2 py-2 font-semibold">Remarks</th>
                <th className="px-2 py-2 font-semibold">Stock Book<br /><span className="font-normal normal-case text-slate-400">Page / Vol</span></th>
                <th className="px-2 py-2 font-semibold">Day Book<br /><span className="font-normal normal-case text-slate-400">Page / Vol</span></th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-2 py-2">
                    <div className={cell}>
                      <SearchableSelect
                        value={r.group_id}
                        onChange={(v) => setRow(r.key, { group_id: v })}
                        options={groupOpts}
                        placeholder="Group"
                      />
                      <button
                        type="button"
                        onClick={addGroup}
                        className="mt-1 text-xs font-medium text-brand-600 hover:underline"
                      >
                        + Add New
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className={cell}>
                      <SearchableSelect
                        value={r.item_id}
                        onChange={(v) => setRow(r.key, { item_id: v })}
                        options={itemOpts}
                        placeholder="Item"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className={cell}>
                      <SearchableSelect
                        value={r.make_id}
                        onChange={(v) => setRow(r.key, { make_id: v, model_id: "" })}
                        options={makeOpts}
                        placeholder="Make"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className={cell}>
                      <SearchableSelect
                        value={r.model_id}
                        onChange={(v) => setRow(r.key, { model_id: v })}
                        options={modelOptsFor(r.make_id)}
                        placeholder="Model"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      className="min-w-[10rem]"
                      value={r.description}
                      onChange={(e) => setRow(r.key, { description: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      className="min-w-[9rem]"
                      value={r.purpose}
                      onChange={(e) => setRow(r.key, { purpose: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      className="w-20"
                      value={r.qty}
                      onChange={(e) => setRow(r.key, { qty: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      className="min-w-[9rem]"
                      value={r.remarks}
                      onChange={(e) => setRow(r.key, { remarks: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <Input type="number" className={numCell} placeholder="Pg" value={r.sb_page} onChange={(e) => setRow(r.key, { sb_page: e.target.value })} />
                      <Input type="number" className={numCell} placeholder="Vol" value={r.sb_vol} onChange={(e) => setRow(r.key, { sb_vol: e.target.value })} />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <Input type="number" className={numCell} placeholder="Pg" value={r.db_page} onChange={(e) => setRow(r.key, { db_page: e.target.value })} />
                      <Input type="number" className={numCell} placeholder="Vol" value={r.db_vol} onChange={(e) => setRow(r.key, { db_vol: e.target.value })} />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <TableAction
                      tone="delete"
                      icon={Trash2}
                      onClick={() => removeRow(r.key)}
                      title="Remove item"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4" />{" "}
            {saving ? "Saving…" : editing ? "Update Indent" : "Save Indent"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
