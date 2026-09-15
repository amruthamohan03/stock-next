"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api-client";
import { Plus, Printer, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
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

/**
 * One grid cell: an editable input on screen, flat text when printing.
 * An `<input>` prints at its full box height, which is what pushed every row
 * onto a page of its own — the print twin collapses the row to its content.
 */
function Cell({
  value,
  onChange,
  align = "left",
  inputMode,
  readOnly,
  title,
}: {
  value: string;
  onChange?: (v: string) => void;
  align?: "left" | "right";
  inputMode?: "numeric" | "decimal";
  readOnly?: boolean;
  title?: string;
}) {
  const alignCls = align === "right" ? "text-right" : "";
  return (
    <>
      <input
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        inputMode={inputMode}
        title={title}
        className={`${cellInput} kfc-screen-only ${alignCls} ${readOnly ? "cursor-default" : ""}`}
      />
      <div className={`kfc-print-only px-1 py-0.5 ${alignCls}`}>{value}</div>
    </>
  );
}

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
  const toast = useToast();
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
    const result = await apiRequest("/api/kfc-form-13", {
      method: editing ? "PUT" : "POST",
      body: {
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
      },
    });
    setSaving(false);
    if (result.success) {
      toast.success(result.message || `${editing ? "Updated" : "Saved"} K.F.C. Form 13`);
      router.push("/report/kfc-form-13");
      router.refresh();
    } else {
      // Keep the inline banner too: the editor is long, and the toast may
      // scroll out of view before the user reaches the Save button again.
      setMsg({ ok: false, text: result.message });
      toast.error(result.message);
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
      <div className="printable kfc-sheet rounded-lg border border-line bg-white p-4">
        <div className="overflow-x-auto">
          <table className="kfc-table w-full border-collapse text-xs" style={{ minWidth: "68rem" }}>
            {/* Column widths live here, not on the <th>s: the print layout is
                `table-layout: fixed`, which sizes from the <col>s and otherwise only
                from the first row — and the first row cannot size columns 6 and 7,
                because they sit under a single colSpan header. */}
            <colgroup>
              {["4%", "30%", "7%", "7%", "7%", "5%", "6%", "6%", "8%", "8%", "6%", "6%"].map(
                (w, i) => (
                  <col key={i} style={{ width: w }} />
                )
              )}
              <col className="no-print" style={{ width: "3rem" }} />
            </colgroup>
            <thead>
              {/* @page has no margin, so the browser prints no header/footer — which
                  means the sheet supplies its own margins. This spacer repeats with
                  the thead and gives every page its top gap; the tfoot twin below
                  does the same at the bottom. */}
              <tr className="kfc-gap" aria-hidden="true">
                <td className="kfc-gap-cell" colSpan={13} />
              </tr>
              <tr>
                <th className="kfc-title border border-slate-400 px-2 py-2 text-center" colSpan={12}>
                  <div className="text-sm font-semibold text-slate-700">
                    Government Polytechnic College Nedumkandam
                  </div>
                  <div className="text-base font-bold tracking-wide text-slate-900">
                    REVERSE OF K.F.C. FORM 13
                  </div>
                </th>
                <th className="no-print border border-slate-400" />
              </tr>
              <tr className="text-center align-middle text-[11px] font-semibold text-slate-700">
                <th className="border border-slate-400 px-1 py-1" rowSpan={2}>
                  Serial number
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2}>
                  Articles with full description and accurate specification, etc.
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2}>
                  Stock on hand after verification
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2}>
                  Purchase of the year including goods on order
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2}>
                  Quantity required for the year
                </th>
                <th className="border border-slate-400 px-1 py-1" colSpan={2}>
                  Rate at which last purchased or estimated cost if fresh purchase
                  (which would be specified)
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2}>
                  Name of last supplier
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2}>
                  Purpose for which articles are required to guide supply
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2}>
                  Place at which delivery is sought
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2}>
                  Classification number
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2}>
                  Remarks
                </th>
                <th className="no-print border border-slate-400 px-1 py-1" rowSpan={2} />
              </tr>
              <tr className="text-center text-[11px] font-semibold text-slate-700">
                <th className="border border-slate-400 px-1 py-1">Unit</th>
                <th className="border border-slate-400 px-1 py-1">Amount Rs.</th>
              </tr>
              <tr className="kfc-nums text-center text-[10px] text-slate-500">
                {Array.from({ length: 12 }, (_, i) => (
                  <th key={i} className="border border-slate-400 py-0.5 font-normal">
                    {i + 1}
                  </th>
                ))}
                <th className="no-print border border-slate-400" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className="kfc-row align-top">
                  {/* 1 */}
                  <td className="border border-slate-400 px-1 py-1 text-center text-xs text-slate-600">
                    {i + 1}
                  </td>
                  {/* 2 Articles — item picker + expandable description */}
                  <td className="kfc-article border border-slate-400 px-1 py-1">
                    <div className="no-print mb-1">
                      <SearchableSelect
                        value={r.item_id}
                        onChange={(v) => pickItem(r.key, v)}
                        options={itemOpts}
                        placeholder="Select item…"
                      />
                    </div>
                    <AutoGrowTextarea
                      value={r.article}
                      onChange={(e) => setRow(r.key, { article: e.target.value })}
                      placeholder="Full description / specification…"
                      className={`${cellInput} kfc-screen-only`}
                    />
                    <div className="kfc-print-only whitespace-pre-wrap px-1 py-0.5">
                      {r.article}
                    </div>
                  </td>
                  {/* 3 Stock on hand (auto) */}
                  <td className="border border-slate-400">
                    <Cell
                      value={r.stock_on_hand}
                      onChange={(v) => setRow(r.key, { stock_on_hand: v })}
                      align="right"
                      inputMode="numeric"
                    />
                  </td>
                  {/* 4 Purchase of the year */}
                  <td className="border border-slate-400">
                    <Cell
                      value={r.purchase_year}
                      onChange={(v) => setRow(r.key, { purchase_year: v })}
                      align="right"
                      inputMode="numeric"
                    />
                  </td>
                  {/* 5 Quantity required */}
                  <td className="border border-slate-400">
                    <Cell
                      value={r.qty_required}
                      onChange={(v) => setRow(r.key, { qty_required: v })}
                      align="right"
                      inputMode="decimal"
                    />
                  </td>
                  {/* 6 Rate — Unit */}
                  <td className="border border-slate-400">
                    <Cell
                      value={r.rate_unit}
                      onChange={(v) => setRow(r.key, { rate_unit: v })}
                      align="right"
                      inputMode="decimal"
                    />
                  </td>
                  {/* 7 Rate — Amount (auto) */}
                  <td className="border border-slate-400 bg-slate-50/60">
                    <Cell
                      value={amountOf(r)}
                      readOnly
                      align="right"
                      title="Auto: Quantity × Unit rate"
                    />
                  </td>
                  {/* 8 Supplier */}
                  <td className="border border-slate-400">
                    <Cell value={r.supplier} onChange={(v) => setRow(r.key, { supplier: v })} />
                  </td>
                  {/* 9 Purpose */}
                  <td className="border border-slate-400">
                    <Cell value={r.purpose} onChange={(v) => setRow(r.key, { purpose: v })} />
                  </td>
                  {/* 10 Delivery place */}
                  <td className="border border-slate-400">
                    <Cell
                      value={r.delivery_place}
                      onChange={(v) => setRow(r.key, { delivery_place: v })}
                    />
                  </td>
                  {/* 11 Classification number */}
                  <td className="border border-slate-400">
                    <Cell
                      value={r.classification_no}
                      onChange={(v) => setRow(r.key, { classification_no: v })}
                    />
                  </td>
                  {/* 12 Remarks */}
                  <td className="border border-slate-400">
                    <Cell value={r.remarks} onChange={(v) => setRow(r.key, { remarks: v })} />
                  </td>
                  <td className="no-print border border-slate-400 text-center">
                    <div className="flex justify-center">
                      <TableAction tone="delete" icon={Trash2} onClick={() => removeRow(r.key)} title="Remove row" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="kfc-gap" aria-hidden="true">
              <tr>
                <td className="kfc-gap-cell" colSpan={13} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Signatory block */}
        {(signName || signDesignation) && (
          <div className="kfc-sign mt-8 flex justify-end">
            <div className="text-center text-xs text-slate-800">
              <div className="h-10" />
              <div className="font-semibold">{signName || " "}</div>
              <div className="text-slate-600">{signDesignation}</div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .kfc-table { border-collapse: collapse; }
        .kfc-table, .kfc-table th, .kfc-table td { border: 1px solid #334155; }
        .kfc-print-only, .kfc-gap { display: none; }
        @media print {
          aside, header { display: none !important; }
          main { padding: 0 !important; background: #fff !important; overflow: visible !important; }
          .no-print, .kfc-screen-only { display: none !important; }
          .kfc-print-only { display: block !important; }
          /* The shared .printable rule pins reports with position:absolute, which
             clips a table that spans pages. Every other element on this page is
             already display:none above, so the sheet can flow normally instead. */
          .kfc-sheet {
            position: static !important;
            width: auto !important;
            margin: 0 !important;
            border: 0 !important;
            /* Horizontal page margin — box padding applies on every page,
               unlike vertical padding, which only lands on the first and last. */
            padding: 0 8mm 8mm !important;
            font-family: "Times New Roman", Times, serif !important;
          }
          .kfc-table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed;
            border: 0 !important;
          }
          .kfc-table th, .kfc-table td {
            border: 1px solid #000 !important;
            background: transparent !important;
            color: #000 !important;
            font-family: inherit !important;
            font-size: 9.5px !important;
            font-weight: normal !important;
            line-height: 1.25 !important;
            padding: 3px 4px !important;
            text-align: center;
            vertical-align: middle !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* The specification column is the only one set flush left and top;
             every other column is centred both ways, as on the official form. */
          .kfc-table td.kfc-article { text-align: left; vertical-align: top !important; }
          /* The cell already carries the padding; the twin must not add its own,
             and it inherits the column's alignment rather than the screen's. */
          .kfc-table .kfc-print-only { padding: 0 !important; text-align: inherit !important; }
          /* Data cells may break mid-token (unspaced specs, long part numbers);
             headers wrap on spaces only, so a word like "number" never splits. */
          .kfc-table td { overflow-wrap: anywhere; }
          .kfc-table .kfc-nums th { font-weight: bold !important; }
          .kfc-table .kfc-title { padding: 5px 4px !important; }
          .kfc-table .kfc-title div:first-child { font-size: 11px !important; }
          .kfc-table .kfc-title div:last-child { font-size: 12px !important; font-weight: bold !important; }
          /* Repeat the title and the three header rows at the top of every page. */
          .kfc-table thead { display: table-header-group; }
          .kfc-row, .kfc-sign { break-inside: avoid; page-break-inside: avoid; }
          tr.kfc-gap { display: table-row !important; }
          tfoot.kfc-gap { display: table-footer-group !important; }
          .kfc-table .kfc-gap-cell {
            border: 0 !important;
            height: 8mm !important;
            padding: 0 !important;
          }
          /* Chrome paints its page header/footer (title, URL, page number, date)
             inside the @page margin box. With no margin there is nowhere to paint
             them, so they are omitted — the sheet provides the margins instead. */
          @page { size: A4 landscape; margin: 0; }
        }
      `}</style>
    </div>
  );
}
