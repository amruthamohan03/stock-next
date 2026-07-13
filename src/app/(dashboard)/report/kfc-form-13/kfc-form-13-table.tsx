"use client";

import { useRef, useState } from "react";
import { Plus, Printer, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SeedRow = { article: string; stock_on_hand: number };

type Row = { id: number; article: string; stock: string };

const MIN_ROWS = 15;

const cellInput =
  "w-full bg-transparent px-1 py-1 text-xs text-slate-800 outline-none focus:bg-brand-50/60";

// A single form row. Amount (col 7) auto-computes as Quantity (col 5) × Unit (col 6)
// live on input. Cells are uncontrolled inputs read via refs to keep re-renders cheap.
function FormRow({
  index,
  article,
  stock,
  onRemove,
}: {
  index: number;
  article: string;
  stock: string;
  onRemove: () => void;
}) {
  const qtyRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const recalc = () => {
    if (!amountRef.current) return;
    const q = parseFloat(qtyRef.current?.value ?? "");
    const u = parseFloat(unitRef.current?.value ?? "");
    // Only compute once BOTH quantity and unit rate are present.
    if (Number.isNaN(q) || Number.isNaN(u)) {
      amountRef.current.value = "";
      return;
    }
    const amount = q * u;
    amountRef.current.value = Number.isFinite(amount)
      ? String(Number(amount.toFixed(2)))
      : "";
  };

  return (
    <tr className="align-top">
      <td className="border border-slate-300 px-1 py-1 text-center text-xs text-slate-600">
        {index + 1}
      </td>
      <td className="border border-slate-300">
        <input className={cellInput} defaultValue={article} />
      </td>
      <td className="border border-slate-300">
        <input className={`${cellInput} text-right`} defaultValue={stock} />
      </td>
      {/* 4 Purchase of the year including goods on order */}
      <td className="border border-slate-300">
        <input className={cellInput} />
      </td>
      {/* 5 Quantity required for the year */}
      <td className="border border-slate-300">
        <input ref={qtyRef} onInput={recalc} className={`${cellInput} text-right`} inputMode="decimal" />
      </td>
      {/* 6 Rate — Unit */}
      <td className="border border-slate-300">
        <input ref={unitRef} onInput={recalc} className={`${cellInput} text-right`} inputMode="decimal" />
      </td>
      {/* 7 Rate — Amount Rs. (auto = col5 × col6) */}
      <td className="border border-slate-300 bg-slate-50/60">
        <input
          ref={amountRef}
          readOnly
          className={`${cellInput} cursor-default text-right`}
          title="Auto: Quantity × Unit rate"
        />
      </td>
      {/* 8 Name of last supplier */}
      <td className="border border-slate-300">
        <input className={cellInput} />
      </td>
      {/* 9 Purpose */}
      <td className="border border-slate-300">
        <input className={cellInput} />
      </td>
      {/* 10 Place at which delivery is sought */}
      <td className="border border-slate-300">
        <input className={cellInput} />
      </td>
      {/* 11 Classification number */}
      <td className="border border-slate-300">
        <input className={cellInput} />
      </td>
      {/* 12 Remarks */}
      <td className="border border-slate-300">
        <input className={cellInput} />
      </td>
      <td className="no-print border border-slate-300 text-center">
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-slate-400 hover:text-red-500"
          title="Remove row"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

export default function KfcForm13({ seed }: { seed: SeedRow[] }) {
  const nextId = useRef(0);
  const makeRows = (): Row[] => {
    const base = seed.map((s) => ({
      id: nextId.current++,
      article: s.article,
      stock: String(s.stock_on_hand ?? ""),
    }));
    while (base.length < MIN_ROWS) {
      base.push({ id: nextId.current++, article: "", stock: "" });
    }
    return base;
  };

  const [rows, setRows] = useState<Row[]>(makeRows);

  const addRow = (n = 1) =>
    setRows((r) => [
      ...r,
      ...Array.from({ length: n }, () => ({ id: nextId.current++, article: "", stock: "" })),
    ]);
  const removeRow = (id: number) => setRows((r) => r.filter((x) => x.id !== id));
  const reset = () => {
    nextId.current = 0;
    setRows(makeRows());
  };

  return (
    <div className="space-y-4">
      {/* Toolbar — hidden when printing */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-slate-800">K.F.C. Form 13</h1>
          <p className="text-sm text-slate-500">
            Article &amp; stock-on-hand seeded from live data; fill the remaining
            columns, then print.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => addRow(1)}>
            <Plus className="h-4 w-4" /> Add row
          </Button>
          <Button variant="outline" size="sm" onClick={() => addRow(5)}>
            <Plus className="h-4 w-4" /> Add 5
          </Button>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* Printable form */}
      <div className="kfc-sheet rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 text-center">
          <div className="text-sm font-semibold text-slate-700">
            Government Polytechnic College Nedumkandam
          </div>
          <div className="text-base font-bold tracking-wide text-slate-900">
            REVERSE OF K.F.C. FORM 13
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="kfc-table w-full border-collapse text-xs">
            <thead>
              <tr className="text-center align-middle text-[11px] font-semibold text-slate-700">
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "4%" }}>
                  Serial number
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "15%" }}>
                  Articles with full description and accurate specification, etc.
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "7%" }}>
                  Stock on hand after verification
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "9%" }}>
                  Purchase of the year including goods on order
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "8%" }}>
                  Quantity required for the year
                </th>
                <th className="border border-slate-400 px-1 py-1" colSpan={2}>
                  Rate at which last purchased or estimated cost if fresh purchase
                  (which would be specified)
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "11%" }}>
                  Name of last supplier
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "13%" }}>
                  Purpose for which articles are required to guide supply
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "11%" }}>
                  Place at which delivery is sought
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "8%" }}>
                  Classification number
                </th>
                <th className="border border-slate-400 px-1 py-1" rowSpan={2} style={{ width: "10%" }}>
                  Remarks
                </th>
                <th className="no-print border border-slate-400 px-1 py-1" rowSpan={2} />
              </tr>
              <tr className="text-center text-[11px] font-semibold text-slate-700">
                <th className="border border-slate-400 px-1 py-1" style={{ width: "6%" }}>
                  Unit
                </th>
                <th className="border border-slate-400 px-1 py-1" style={{ width: "7%" }}>
                  Amount Rs.
                </th>
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
              {rows.map((row, i) => (
                <FormRow
                  key={row.id}
                  index={i}
                  article={row.article}
                  stock={row.stock}
                  onRemove={() => removeRow(row.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-right text-[10px] italic text-slate-400">
          Form printed from www.finance.kerala.gov.in
        </div>
      </div>

      <style>{`
        .kfc-table { border-collapse: collapse; }
        .kfc-table,
        .kfc-table th,
        .kfc-table td { border: 1px solid #334155; }
        @media print {
          aside, header { display: none !important; }
          main { padding: 0 !important; background: #fff !important; overflow: visible !important; }
          .no-print { display: none !important; }
          .kfc-sheet { border: 0 !important; padding: 0 !important; }
          .kfc-table { font-size: 9px !important; }
          .kfc-table input { font-size: 9px !important; }
          /* Keep the grid solid on paper */
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
