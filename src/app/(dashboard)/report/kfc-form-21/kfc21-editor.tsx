"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SignatorySelect } from "@/components/ui/signatory-select";
import { TableAction } from "@/components/ui/table-action";
import type { KfcItem } from "../kfc-form-13/items";
import type { Signatory } from "@/lib/signatories";

export type EditorRow = {
  item_id: string;
  quantity: string;
  description: string;
  book_rate: string;
  book_amount: string;
  assessed_value: string;
  date_of_receipt: string;
  cause_remarks: string;
  authority_remarks: string;
};

export type Kfc21Initial = {
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
  quantity: "",
  description: "",
  book_rate: "",
  book_amount: "",
  assessed_value: "",
  date_of_receipt: "",
  cause_remarks: "",
  authority_remarks: "",
});

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const cellInput =
  "w-full bg-transparent px-1 py-1 text-xs text-slate-800 outline-none focus:bg-brand-50/60";

export default function KfcForm21Editor({
  items,
  signatories,
  initial,
}: {
  items: KfcItem[];
  signatories: Signatory[];
  initial?: Kfc21Initial;
}) {
  const router = useRouter();
  const editing = !!initial;
  const keyRef = useState(() => ({ n: initial?.items.length ?? 1 }))[0];

  const [title, setTitle] = useState(initial?.title ?? "Survey Report of Stores");
  const [date, setDate] = useState(initial?.form_date || todayIso());
  const [signedBy, setSignedBy] = useState(initial?.signed_by ?? "");
  const [signName, setSignName] = useState(initial?.signatory_name ?? "");
  const [signDesignation, setSignDesignation] = useState(initial?.signatory_designation ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    initial && initial.items.length
      ? initial.items.map((it, i) => ({ key: i, ...it }))
      : [blank(0)]
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const itemOpts = useMemo(() => items.map((i) => ({ value: i.id, label: i.name })), [items]);

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = (n = 1) =>
    setRows((rs) => [...rs, ...Array.from({ length: n }, () => blank(keyRef.n++))]);
  const removeRow = (key: number) =>
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.key !== key)));

  // Selecting an item fills the description (col 2) with its name.
  const pickItem = (key: number, value: string) => {
    const item = items.find((i) => String(i.id) === value);
    setRow(key, { item_id: value, description: item ? item.name : "" });
  };

  // Convenience: amount = quantity × rate (user can still override the field).
  const autoAmount = (r: Row) => {
    const q = parseFloat(r.quantity);
    const u = parseFloat(r.book_rate);
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
    const filled = rows.filter((r) => r.item_id || r.description.trim() || r.quantity.trim());
    if (filled.length === 0) {
      setMsg({ ok: false, text: "Add at least one article row." });
      return;
    }
    setSaving(true);
    const res = await fetch("/api/kfc-form-21", {
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
          quantity: r.quantity,
          description: r.description,
          book_rate: r.book_rate,
          book_amount: r.book_amount || autoAmount(r),
          assessed_value: r.assessed_value,
          date_of_receipt: r.date_of_receipt,
          cause_remarks: r.cause_remarks,
          authority_remarks: r.authority_remarks,
        })),
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      router.push("/report/kfc-form-21");
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
              {editing ? "Edit K.F.C. Form 21" : "New K.F.C. Form 21"}
            </h1>
            <p className="text-sm text-muted">
              Survey report of stores that have become unserviceable. Pick an item to
              fill its description, then enter the values.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/report/kfc-form-21")}>
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

        {/* Officer in charge (signatory) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label>Officer in charge</Label>
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
            <Label>Name on the form</Label>
            <Input value={signName} onChange={(e) => setSignName(e.target.value)} placeholder="Officer in charge name" />
          </div>
          <div>
            <Label>Designation</Label>
            <Input
              value={signDesignation}
              onChange={(e) => setSignDesignation(e.target.value)}
              placeholder="e.g. Demonstrator in CT"
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
          <div className="text-base font-bold tracking-wide text-slate-900">K.F.C FORM 21</div>
          <div className="text-[11px] italic text-slate-600">(See Chapter VI, Article 156, Note)</div>
          <div className="mt-1 text-sm font-bold uppercase text-slate-800">Survey Report of Stores</div>
          <div className="text-[11px] text-slate-600">
            Report of the Survey of Stores which have become unserviceable
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="kfc-table w-full border-collapse text-xs" style={{ minWidth: "62rem" }}>
            <thead>
              <tr className="text-center align-middle text-[11px] font-semibold text-slate-700">
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "8%" }}>
                  Number or Quantity
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "22%" }}>
                  Description of articles
                </th>
                <th className="border border-slate-400 px-1 py-1" colSpan={2}>
                  Value on the Books
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "13%" }}>
                  Assessed value with reference to the condition of the articles and the
                  existing market price
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "10%" }}>
                  Date of receipt
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "16%" }}>
                  Remarks by the subordinate in charge explaining the cause of the articles
                  becoming unserviceable
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "12%" }}>
                  Remarks or orders of the competent authority
                </th>
                <th className="no-print border border-slate-400 px-1 py-1" rowSpan={2} />
              </tr>
              <tr className="text-center text-[11px] font-semibold text-slate-700">
                <th className="border border-slate-400 px-1 py-1" style={{ width: "8%" }}>Rate</th>
                <th className="border border-slate-400 px-1 py-1" style={{ width: "9%" }}>Amount</th>
              </tr>
              <tr className="text-center text-[10px] text-slate-500">
                {Array.from({ length: 8 }, (_, i) => (
                  <th key={i} className="border border-slate-400 py-0.5 font-normal">
                    {i + 1}
                  </th>
                ))}
                <th className="no-print border border-slate-400" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="align-top">
                  {/* 1 Number or Quantity */}
                  <td className="border border-slate-400">
                    <input
                      value={r.quantity}
                      onChange={(e) => setRow(r.key, { quantity: e.target.value })}
                      inputMode="numeric"
                      className={`${cellInput} text-right`}
                    />
                  </td>
                  {/* 2 Description — item picker + free text */}
                  <td className="border border-slate-400 px-1 py-1">
                    <div className="no-print mb-1">
                      <SearchableSelect
                        value={r.item_id}
                        onChange={(v) => pickItem(r.key, v)}
                        options={itemOpts}
                        placeholder="Select item…"
                      />
                    </div>
                    <textarea
                      value={r.description}
                      onChange={(e) => setRow(r.key, { description: e.target.value })}
                      rows={2}
                      placeholder="Description of article…"
                      className={`${cellInput} resize-none whitespace-pre-wrap`}
                    />
                  </td>
                  {/* 3 Rate */}
                  <td className="border border-slate-400">
                    <input
                      value={r.book_rate}
                      onChange={(e) => setRow(r.key, { book_rate: e.target.value })}
                      inputMode="decimal"
                      className={`${cellInput} text-right`}
                    />
                  </td>
                  {/* 4 Amount (auto suggestion via placeholder) */}
                  <td className="border border-slate-400">
                    <input
                      value={r.book_amount}
                      onChange={(e) => setRow(r.key, { book_amount: e.target.value })}
                      inputMode="decimal"
                      placeholder={autoAmount(r)}
                      className={`${cellInput} text-right`}
                      title="Leave blank to use Quantity × Rate"
                    />
                  </td>
                  {/* 5 Assessed value */}
                  <td className="border border-slate-400">
                    <input
                      value={r.assessed_value}
                      onChange={(e) => setRow(r.key, { assessed_value: e.target.value })}
                      inputMode="decimal"
                      className={`${cellInput} text-right`}
                    />
                  </td>
                  {/* 6 Date of receipt */}
                  <td className="border border-slate-400">
                    <input
                      type="date"
                      value={r.date_of_receipt}
                      onChange={(e) => setRow(r.key, { date_of_receipt: e.target.value })}
                      className={cellInput}
                    />
                  </td>
                  {/* 7 Cause remarks */}
                  <td className="border border-slate-400">
                    <input
                      value={r.cause_remarks}
                      onChange={(e) => setRow(r.key, { cause_remarks: e.target.value })}
                      placeholder="e.g. Prolonged use"
                      className={cellInput}
                    />
                  </td>
                  {/* 8 Authority remarks */}
                  <td className="border border-slate-400">
                    <input
                      value={r.authority_remarks}
                      onChange={(e) => setRow(r.key, { authority_remarks: e.target.value })}
                      className={cellInput}
                    />
                  </td>
                  <td className="no-print border border-slate-400 text-center">
                    <div className="flex justify-center">
                      <TableAction tone="delete" icon={Trash2} onClick={() => removeRow(r.key)} title="Remove row" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer notes + officer block */}
        <div className="mt-6 flex justify-between gap-6 text-[11px] text-slate-700">
          <div className="max-w-md space-y-0.5">
            <div>*Authority to write off should be obtained in this form.</div>
            <div>
              †If the book value is not known, the replacement value should be entered in
              this column.
            </div>
          </div>
          <div className="space-y-1 text-slate-800">
            <div className="font-semibold">Officer in charge: {signName || "…"}</div>
            <div>Signature:</div>
            <div>Designation: {signDesignation || "…"}</div>
            <div>Date: {date ? date.split("-").reverse().join("-") : "…"}</div>
          </div>
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
