import { CheckCircle2 } from "lucide-react";
import { REGIMES, REGIME_LABEL, inr, type Regime, type TaxResult } from "@/lib/income-tax";

/**
 * Old vs new regime, side by side, with the cheaper one marked. Presentational
 * only (no hooks) so the editor's live preview and the statement page share it.
 */
export default function RegimeCompare({
  results,
  selected,
  better,
  saving,
  onSelect,
}: {
  results: Record<Regime, TaxResult>;
  selected: Regime;
  better: Regime;
  saving: number;
  /** When given, each column becomes a button that switches the regime. */
  onSelect?: (r: Regime) => void;
}) {
  const rows: [string, (r: TaxResult) => number][] = [
    ["Gross salary", (r) => r.gross_salary],
    ["Gross total income", (r) => r.gross_total_income],
    ["Deductions", (r) => r.total_deductions],
    ["Taxable income", (r) => r.taxable_income],
    ["Tax payable", (r) => r.net_tax],
    ["Balance to deduct", (r) => r.balance],
    ["Per month", (r) => r.monthly_tds],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {REGIMES.map((regime) => {
          const r = results[regime];
          const active = regime === selected;
          const box = `rounded-xl border p-3 text-left transition-colors ${
            active ? "border-accent/60 bg-accent-soft" : "border-line bg-elevated"
          }`;
          const body = (
            <>
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-muted">{REGIME_LABEL[regime]}</span>
                {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />}
              </div>
              <div className="mt-1 text-lg font-bold tabular-nums text-fg">{inr(r.net_tax)}</div>
              {regime === better && saving > 0 && (
                <span className="mt-1 inline-flex rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-500 ring-1 ring-inset ring-emerald-500/25">
                  Saves {inr(saving)}
                </span>
              )}
            </>
          );
          return onSelect ? (
            <button
              key={regime}
              type="button"
              onClick={() => onSelect(regime)}
              aria-pressed={active}
              className={`${box} hover:border-accent/50`}
            >
              {body}
            </button>
          ) : (
            <div key={regime} className={box}>
              {body}
            </div>
          );
        })}
      </div>

      <dl className="divide-y divide-line rounded-xl border border-line text-sm">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-elevated px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
          <span />
          <span className="w-24 text-right">New</span>
          <span className="w-24 text-right">Old</span>
        </div>
        {rows.map(([label, pick]) => (
          <div key={label} className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-1.5">
            <dt className="text-muted">{label}</dt>
            {REGIMES.map((regime) => (
              <dd
                key={regime}
                className={`w-24 text-right tabular-nums ${
                  regime === selected ? "font-semibold text-fg" : "text-muted"
                }`}
              >
                {inr(pick(results[regime]))}
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </div>
  );
}
