"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, Trash2, Save, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SignatorySelect } from "@/components/ui/signatory-select";
import { TableAction } from "@/components/ui/table-action";
import type { KfcItem } from "./items";
import type { Signatory } from "@/lib/signatories";

export type EditorRow = {
  item_id: string;
  article: string;
  stock_on_hand: string;
  purchase_year: string;
  qty_required: string;
  rate_unit: string;
  supplier: string;
  purpose: string;
  delivery_place: string;
  classification_no: string;
  remarks: string;
};

export type KfcInitial = {
  id: number;
  title: string;
  form_date: string;
  signed_by: string;
  signatory_name: string;
  signatory_designation: string;
  items: EditorRow[];
};

type Row = EditorRow & { key: number };

const blank = (key: number): Row => ({
  key,
  item_id: "",
  article: "",
  stock_on_hand: "",
  purchase_year: "",
  qty_required: "",
  rate_unit: "",
  supplier: "",
  purpose: "",
  delivery_place: "",
  classification_no: "",
  remarks: "",
});

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const cellInput =
  "w-full bg-transparent px-1 py-1 text-xs text-slate-800 outline-none focus:bg-brand-50/60";

export default function KfcForm13Editor({
  items,
  signatories,
  initial,
}: {
  items: KfcItem[];
  signatories: Signatory[];
  initial?: KfcInitial;
}) {
  const router = useRouter();
  const editing = !!initial;
  const keyRef = useState(() => ({ n: initial?.items.length ?? 1 }))[0];

  const [title, setTitle] = useState(initial?.title ?? "K.F.C. Form 13");
  const [date, setDate] = useState(initial?.form_date || todayIso());
  const [signedBy, setSignedBy] = useState(initial?.signed_by ?? "");
  const [signName, setSignName] = useState(initial?.signatory_name ?? "");
  const [signDesignation, setSignDesignation] = useState(initial?.signatory_designation ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    initial && initial.items.length
      ? initial.items.map((it, i) => ({ key: i, ...it }))
      : [blank(0)]
  );
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const itemOpts = useMemo(
    () => items.map((i) => ({ value: i.id, label: i.name })),
    [items]
  );
  const stockById = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(String(i.id), i.stock_on_hand);
    return m;
  }, [items]);

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = (n = 1) =>
    setRows((rs) => [...rs, ...Array.from({ length: n }, () => blank(keyRef.n++))]);
  const removeRow = (key: number) =>
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.key !== key)));
  const toggleExpand = (key: number) =>
    setExpanded((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Selecting an item fills col 2 (article) + col 3 (stock on hand).
  const pickItem = (key: number, value: string) => {
    const item = items.find((i) => String(i.id) === value);
    setRow(key, {
      item_id: value,
      stock_on_hand: value ? String(stockById.get(value) ?? 0) : "",
      article: item ? item.name : "",
    });
  };

  const amountOf = (r: Row) => {
    const q = parseFloat(r.qty_required);
    const u = parseFloat(r.rate_unit);
    if (Number.isNaN(q) || Number.isNaN(u)) return "";
    const a = q * u;
    return Number.isFinite(a) ? String(Number(a.toFixed(2))) : "";
  };

  const save = async () => {
    setMsg(null);
    if (!title.trim()) {
      setMsg({ ok: false, text: "Title is required." });
      return;
    }
    const filled = rows.filter((r) => r.item_id || r.article.trim());
    if (filled.length === 0) {
      setMsg({ ok: false, text: "Add at least one article row." });
      return;
    }
    setSaving(true);
    const res = await fetch("/api/kfc-form-13", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: initial?.id,
        title,
        form_date: date,
        signed_by: signedBy || null,
        signatory_name: signName,
        signatory_designation: signDesignation,
        items: filled.map((r) => ({
          item_id: r.item_id || null,
          article: r.article,
          stock_on_hand: r.stock_on_hand,
          purchase_year: r.purchase_year,
          qty_required: r.qty_required,
          rate_unit: r.rate_unit,
          rate_amount: amountOf(r),
          supplier: r.supplier,
          purpose: r.purpose,
          delivery_place: r.delivery_place,
          classification_no: r.classification_no,
          remarks: r.remarks,
        })),
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      router.push("/report/kfc-form-13");
      router.refresh();
    } else {
      setMsg({ ok: false, text: json.message ?? "Save failed" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar + header fields — hidden when printing */}
      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-fg">
              {editing ? "Edit K.F.C. Form 13" : "New K.F.C. Form 13"}
            </h1>
            <p className="text-sm text-muted">
              Pick an item to auto-fill its stock on hand; expand column 2 to add the
              full specification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/report/kfc-form-13")}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : editing ? "Update" : "Save"}
            </Button>
          </div>
        </div>

        {msg && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.ok ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {/* Signatory — the person who signs the form (may differ from you, the creator) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label>Signed by</Label>
            <SignatorySelect
              signatories={signatories}
              value={signedBy}
              onPick={(s) => {
                setSignedBy(s.id);
                setSignName(s.name);
                setSignDesignation(s.designation);
              }}
            />
          </div>
          <div>
            <Label>Signatory name</Label>
            <Input value={signName} onChange={(e) => setSignName(e.target.value)} placeholder="Name on the form" />
          </div>
          <div>
            <Label>Designation</Label>
            <Input
              value={signDesignation}
              onChange={(e) => setSignDesignation(e.target.value)}
              placeholder="e.g. Head of Department"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => addRow(1)}>
            <Plus className="h-4 w-4" /> Add row
          </Button>
          <Button variant="outline" size="sm" onClick={() => addRow(5)}>
            <Plus className="h-4 w-4" /> Add 5
          </Button>
        </div>
      </div>

      {/* Printable sheet */}
      <div className="kfc-sheet rounded-lg border border-line bg-white p-4">
        <div className="mb-2 text-center">
          <div className="text-sm font-semibold text-slate-700">
            Government Polytechnic College Nedumkandam
          </div>
          <div className="text-base font-bold tracking-wide text-slate-900">
            REVERSE OF K.F.C. FORM 13
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="kfc-table w-full border-collapse text-xs" style={{ minWidth: "68rem" }}>
            <thead>
              <tr className="text-center align-middle text-[11px] font-semibold text-slate-700">
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "3%" }}>
                  Serial number
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "20%" }}>
                  Articles with full description and accurate specification, etc.
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "7%" }}>
                  Stock on hand after verification
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "8%" }}>
                  Purchase of the year including goods on order
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "8%" }}>
                  Quantity required for the year
                </th>
                <th className="border border-slate-400 px-1 py-1" colSpan={2}>
                  Rate at which last purchased or estimated cost if fresh purchase
                  (which would be specified)
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "10%" }}>
                  Name of last supplier
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "12%" }}>
                  Purpose for which articles are required to guide supply
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "10%" }}>
                  Place at which delivery is sought
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "7%" }}>
                  Classification number
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "9%" }}>
                  Remarks
                </th>
                <th className="no-print border border-slate-400 px-1 py-1" rowSpan={2} />
              </tr>
              <tr className="text-center text-[11px] font-semibold text-slate-700">
                <th className="border border-slate-400 px-1 py-1" style={{ width: "6%" }}>Unit</th>
                <th className="border border-slate-400 px-1 py-1" style={{ width: "7%" }}>Amount Rs.</th>
              </tr>
              <tr className="text-center text-[10px] text-slate-500">
                {Array.from({ length: 12 }, (_, i) => (
                  <th key={i} className="border border-slate-400 py-0.5 font-normal">
                    {i + 1}
                  </th>
                ))}
                <th className="no-print border border-slate-400" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isOpen = expanded.has(r.key);
                return (
                  <tr key={r.key} className="align-top">
                    {/* 1 */}
                    <td className="border border-slate-400 px-1 py-1 text-center text-xs text-slate-600">
                      {i + 1}
                    </td>
                    {/* 2 Articles — item picker + expandable description */}
                    <td className="border border-slate-400 px-1 py-1">
                      <div className="no-print mb-1 flex items-center gap-1">
                        <div className="min-w-0 flex-1">
                          <SearchableSelect
                            value={r.item_id}
                            onChange={(v) => pickItem(r.key, v)}
                            options={itemOpts}
                            placeholder="Select item…"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExpand(r.key)}
                          className="shrink-0 rounded-md p-1.5 text-muted hover:bg-elevated hover:text-fg"
                          title={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                      <textarea
                        value={r.article}
                        onChange={(e) => setRow(r.key, { article: e.target.value })}
                        rows={isOpen ? 10 : 2}
                        placeholder="Full description / specification…"
                        className={`${cellInput} resize-none whitespace-pre-wrap`}
                      />
                    </td>
                    {/* 3 Stock on hand (auto) */}
                    <td className="border border-slate-400">
                      <input
                        value={r.stock_on_hand}
                        onChange={(e) => setRow(r.key, { stock_on_hand: e.target.value })}
                        inputMode="numeric"
                        className={`${cellInput} text-right`}
                      />
                    </td>
                    {/* 4 Purchase of the year */}
                    <td className="border border-slate-400">
                      <input
                        value={r.purchase_year}
                        onChange={(e) => setRow(r.key, { purchase_year: e.target.value })}
                        inputMode="numeric"
                        className={`${cellInput} text-right`}
                      />
                    </td>
                    {/* 5 Quantity required */}
                    <td className="border border-slate-400">
                      <input
                        value={r.qty_required}
                        onChange={(e) => setRow(r.key, { qty_required: e.target.value })}
                        inputMode="decimal"
                        className={`${cellInput} text-right`}
                      />
                    </td>
                    {/* 6 Rate — Unit */}
                    <td className="border border-slate-400">
                      <input
                        value={r.rate_unit}
                        onChange={(e) => setRow(r.key, { rate_unit: e.target.value })}
                        inputMode="decimal"
                        className={`${cellInput} text-right`}
                      />
                    </td>
                    {/* 7 Rate — Amount (auto) */}
                    <td className="border border-slate-400 bg-slate-50/60">
                      <input
                        value={amountOf(r)}
                        readOnly
                        className={`${cellInput} cursor-default text-right`}
                        title="Auto: Quantity × Unit rate"
                      />
                    </td>
                    {/* 8 Supplier */}
                    <td className="border border-slate-400">
                      <input
                        value={r.supplier}
                        onChange={(e) => setRow(r.key, { supplier: e.target.value })}
                        className={cellInput}
                      />
                    </td>
                    {/* 9 Purpose */}
                    <td className="border border-slate-400">
                      <input
                        value={r.purpose}
                        onChange={(e) => setRow(r.key, { purpose: e.target.value })}
                        className={cellInput}
                      />
                    </td>
                    {/* 10 Delivery place */}
                    <td className="border border-slate-400">
                      <input
                        value={r.delivery_place}
                        onChange={(e) => setRow(r.key, { delivery_place: e.target.value })}
                        className={cellInput}
                      />
                    </td>
                    {/* 11 Classification number */}
                    <td className="border border-slate-400">
                      <input
                        value={r.classification_no}
                        onChange={(e) => setRow(r.key, { classification_no: e.target.value })}
                        className={cellInput}
                      />
                    </td>
                    {/* 12 Remarks */}
                    <td className="border border-slate-400">
                      <input
                        value={r.remarks}
                        onChange={(e) => setRow(r.key, { remarks: e.target.value })}
                        className={cellInput}
                      />
                    </td>
                    <td className="no-print border border-slate-400 text-center">
                      <div className="flex justify-center">
                        <TableAction tone="delete" icon={Trash2} onClick={() => removeRow(r.key)} title="Remove row" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Signatory block */}
        {(signName || signDesignation) && (
          <div className="mt-8 flex justify-end">
            <div className="text-center text-xs text-slate-800">
              <div className="h-10" />
              <div className="font-semibold">{signName || " "}</div>
              <div className="text-slate-600">{signDesignation}</div>
            </div>
          </div>
        )}

        <div className="mt-2 text-right text-[10px] italic text-slate-400">
          Form printed from www.finance.kerala.gov.in
        </div>
      </div>

      <style>{`
        .kfc-table { border-collapse: collapse; }
        .kfc-table, .kfc-table th, .kfc-table td { border: 1px solid #334155; }
        @media print {
          aside, header { display: none !important; }
          main { padding: 0 !important; background: #fff !important; overflow: visible !important; }
          .no-print { display: none !important; }
          .kfc-sheet { border: 0 !important; padding: 0 !important; }
          .kfc-table { font-size: 9px !important; min-width: 0 !important; }
          .kfc-table input, .kfc-table textarea { font-size: 9px !important; }
          .kfc-table, .kfc-table th, .kfc-table td {
            border: 1px solid #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page { size: A4 landscape; margin: 8mm; }
        }
      `}</style>
    </div>
  );
}
