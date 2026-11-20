"use client";

import { useRef, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { CheckToggle } from "@/components/ui/check-toggle";
import {
  DED_HEADS,
  EARN_HEADS,
  payRates,
  rowDeductions,
  rowEarnings,
  salaryMonths,
  withBasic,
  withDa,
  type HeadKey,
  type PayRates,
  type PayRateSettings,
  type MonthRow,
  type SalaryRow,
} from "@/lib/income-tax";
import { Money } from "./editor-fields";

const SRC_CHIP: Record<string, { label: string; tint: string }> = {
  slip: { label: "Slip", tint: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
  projected: { label: "Projected", tint: "bg-sky-500/15 text-sky-500 ring-sky-500/25" },
};

const fmt = (n: number) => n.toLocaleString("en-IN");

/**
 * The salary details grid: one row per month March → February, earnings then
 * the recoveries that count for tax, and the previous-years arrear rows.
 * ↓ copies a month to every month below it, as the pay rarely changes —
 * except months read from a slip, which keep their real figures.
 */
export default function SalaryGrid({
  fy,
  months,
  salArrear,
  payRevision,
  onMonths,
  onSalArrear,
  onPayRevision,
  pay,
}: {
  fy: string;
  months: MonthRow[];
  salArrear: SalaryRow;
  payRevision: SalaryRow;
  onMonths: (months: MonthRow[]) => void;
  onSalArrear: (row: SalaryRow) => void;
  onPayRevision: (row: SalaryRow) => void;
  /** Pay rates settings; when a DA schedule is set, Basic changes use them. */
  pay: PayRateSettings;
}) {
  const labels = salaryMonths(fy);
  const heads = [...EARN_HEADS, ...DED_HEADS];
  const [auto, setAuto] = useState(true);
  // The month's rates as they stood when its Basic / DA box got focus. Each
  // keystroke is a change, so reading the rates from the row mid-typing would
  // take them from a half-typed Basic ("4" on the way to 43400).
  const rates = useRef<{ row: number; rates: PayRates | null } | null>(null);
  const ratesFor = (i: number) => (rates.current?.row === i ? rates.current.rates : payRates(months, i, pay));
  const editing = (i: number, key: HeadKey) =>
    key === "basic" || key === "da"
      ? {
          onFocus: () => (rates.current = { row: i, rates: payRates(months, i, pay) }),
          onBlur: () => (rates.current = null),
        }
      : {};

  // With auto on, a new Basic re-works DA, HRA (and NPS) at the month's rates,
  // and a new DA re-works NPS. Any figure can still be overtyped afterwards.
  const setCell = (i: number, key: HeadKey, v: number) =>
    onMonths(
      months.map((m, j) => {
        if (j !== i) return m;
        if (auto && key === "basic") return withBasic(m, v, ratesFor(i));
        if (auto && key === "da") return withDa(m, v, ratesFor(i));
        return { ...m, [key]: v };
      })
    );
  const copyDown = (i: number) =>
    onMonths(
      months.map((m, j) => {
        // Months read from an actual slip keep their figures.
        if (j <= i || m.src === "slip") return m;
        const copy: MonthRow = { ...m, src: "" };
        for (const h of heads) copy[h.key] = months[i][h.key];
        return copy;
      })
    );
  const total = (k: HeadKey) => months.reduce((a, m) => a + m[k], 0) + salArrear[k] + payRevision[k];

  const cell = "border-b border-line px-1 py-1";
  const input = "h-8 min-w-[4.75rem] px-1.5";
  const sum = "px-2 text-right tabular-nums font-medium text-fg";

  const arrearRow = (label: string, row: SalaryRow, set: (r: SalaryRow) => void) => (
    <tr className="bg-elevated/40">
      <td className={`${cell} whitespace-nowrap font-medium text-fg`}>{label}</td>
      {EARN_HEADS.map((h) => (
        <td key={h.key} className={cell}>
          <Money value={row[h.key]} onChange={(v) => set({ ...row, [h.key]: v })} className={input} />
        </td>
      ))}
      <td className={`${cell} ${sum}`}>{fmt(rowEarnings(row))}</td>
      {DED_HEADS.map((h) => (
        <td key={h.key} className={cell}>
          <Money value={row[h.key]} onChange={(v) => set({ ...row, [h.key]: v })} className={input} />
        </td>
      ))}
      <td className={`${cell} ${sum}`}>{fmt(rowDeductions(row))}</td>
      <td className={cell} />
    </tr>
  );

  return (
    <div className="space-y-2">
      <div className="max-w-md">
        <CheckToggle
          checked={auto}
          onChange={setAuto}
          label="Work out DA, HRA and NPS from Basic"
          hint={
            pay.da.length
              ? "Changing Basic uses the DA %, HRA % and NPS % in Pay rates"
              : "Changing Basic keeps that month's DA % and HRA %; NPS stays at 10% of Basic + DA"
          }
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead className="text-xs">
            <tr>
              <th className={`${cell} bg-elevated text-left font-semibold text-muted`}>Month</th>
              {EARN_HEADS.map((h) => (
                <th key={h.key} className={`${cell} bg-emerald-500/10 text-right font-semibold text-emerald-500`}>
                  {h.label}
                </th>
              ))}
              <th className={`${cell} bg-emerald-500/10 text-right font-semibold text-emerald-500`}>Gross</th>
              {DED_HEADS.map((h) => (
                <th key={h.key} className={`${cell} bg-amber-500/10 text-right font-semibold text-amber-500`}>
                  {h.label}
                </th>
              ))}
              <th className={`${cell} bg-amber-500/10 text-right font-semibold text-amber-500`}>Ded</th>
              <th className={`${cell} bg-elevated`} />
            </tr>
          </thead>
          <tbody>
            {months.map((m, i) => (
              <tr key={labels[i]}>
                <td className={`${cell} whitespace-nowrap`}>
                  <div className="font-medium text-fg">{labels[i]}</div>
                  {SRC_CHIP[m.src] && (
                    <span
                      className={`mt-0.5 inline-flex rounded px-1 text-[10px] font-medium ring-1 ring-inset ${SRC_CHIP[m.src].tint}`}
                    >
                      {SRC_CHIP[m.src].label}
                    </span>
                  )}
                </td>
                {EARN_HEADS.map((h) => (
                  <td key={h.key} className={cell}>
                    <Money value={m[h.key]} onChange={(v) => setCell(i, h.key, v)} {...editing(i, h.key)} className={input} />
                  </td>
                ))}
                <td className={`${cell} ${sum}`}>{fmt(rowEarnings(m))}</td>
                {DED_HEADS.map((h) => (
                  <td key={h.key} className={cell}>
                    <Money value={m[h.key]} onChange={(v) => setCell(i, h.key, v)} className={input} />
                  </td>
                ))}
                <td className={`${cell} ${sum}`}>{fmt(rowDeductions(m))}</td>
                <td className={`${cell} w-9 text-center`}>
                  {i < 11 && (
                    <button
                      type="button"
                      onClick={() => copyDown(i)}
                      className="rounded-md p-1 text-faint transition-colors hover:bg-accent-soft hover:text-accent"
                      title={`Copy ${labels[i]} to the months below`}
                      aria-label={`Copy ${labels[i]} to the months below`}
                    >
                      <ArrowDownToLine className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {arrearRow("Sal Arrear *", salArrear, onSalArrear)}
            {arrearRow("Pay Revision", payRevision, onPayRevision)}
          </tbody>
          <tfoot className="bg-elevated font-semibold text-fg">
            <tr>
              <td className="px-1.5 py-1.5">Total</td>
              {EARN_HEADS.map((h) => (
                <td key={h.key} className="px-2 py-1.5 text-right tabular-nums">
                  {fmt(total(h.key))}
                </td>
              ))}
              <td className="px-2 py-1.5 text-right tabular-nums">
                {fmt(EARN_HEADS.reduce((a, h) => a + total(h.key), 0))}
              </td>
              {DED_HEADS.map((h) => (
                <td key={h.key} className="px-2 py-1.5 text-right tabular-nums">
                  {fmt(total(h.key))}
                </td>
              ))}
              <td className="px-2 py-1.5 text-right tabular-nums">
                {fmt(DED_HEADS.reduce((a, h) => a + total(h.key), 0))}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-red-500">
        * Only arrears received for previous years go in Sal Arrear. Arrears for the current year belong in
        the month they were drawn, otherwise the NPS and HRA working will be wrong.
      </p>
    </div>
  );
}
