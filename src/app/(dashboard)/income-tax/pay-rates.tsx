"use client";

import { useState } from "react";
import { Calculator, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CheckToggle } from "@/components/ui/check-toggle";
import { FormSection } from "@/components/ui/form-section";
import { useToast } from "@/components/ui/toast";
import {
  applyPayRates,
  detectPayRates,
  normalizePayRates,
  percent,
  salaryMonths,
  type MonthRow,
  type PayRateSettings,
} from "@/lib/income-tax";

/** A percentage box — decimals allowed (DA 42.5%), shown with a % suffix. */
function Pct({
  label,
  hint,
  value,
  onChange,
}: {
  label?: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          value={value || ""}
          placeholder="0"
          onChange={(e) => onChange(percent(e.target.value))}
          className="pr-7 text-right tabular-nums"
          aria-label={label ?? "Percentage"}
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-faint">%</span>
      </div>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

/**
 * DA, HRA and NPS percentages for the year. DA is a schedule because it is
 * revised mid-year. Once set, changing Basic in the grid uses these rates,
 * and "Apply to months" recalculates the whole year in one go.
 */
export default function PayRates({
  fy,
  pay,
  months,
  onPay,
  onMonths,
}: {
  fy: string;
  pay: PayRateSettings;
  months: MonthRow[];
  onPay: (pay: PayRateSettings) => void;
  onMonths: (months: MonthRow[]) => void;
}) {
  const toast = useToast();
  const [includeSlips, setIncludeSlips] = useState(false);
  const labels = salaryMonths(fy);
  const monthOptions = labels.map((l, i) => ({ value: String(i), label: l }));
  const set = (patch: Partial<PayRateSettings>) => onPay(normalizePayRates({ ...pay, ...patch }));
  const setStep = (i: number, patch: Partial<PayRateSettings["da"][number]>) =>
    set({ da: pay.da.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const detect = () => {
    const found = detectPayRates(months);
    if (!found.da.length) {
      toast.warning("Enter a Basic and DA in the salary grid first, or upload a slip.");
      return;
    }
    onPay(found);
    toast.success("Rates read from the salary grid");
  };

  const apply = () => {
    if (!pay.da.length) {
      toast.warning("Set a DA % first.");
      return;
    }
    const { months: next, changed } = applyPayRates(months, pay, includeSlips);
    onMonths(next);
    if (changed) toast.success(`Recalculated DA, HRA and NPS for ${changed} month${changed === 1 ? "" : "s"}`);
    else toast.info("Every month already matches these rates.");
  };

  // The next free month after the last step, for "Add DA revision".
  const nextFrom = Math.min(11, (pay.da[pay.da.length - 1]?.from ?? -1) + 1);

  return (
    <FormSection
      title="Pay rates"
      hint={pay.da.length ? "Used when Basic changes in the grid" : "Not set — DA and HRA follow each month's own figures"}
      className="block space-y-3"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Label>DA % of Basic</Label>
          {pay.da.length === 0 && (
            <p className="text-xs text-faint">No DA rate yet — add one, or detect it from the salary grid.</p>
          )}
          {pay.da.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-muted">{i === 0 ? "From" : "Then"}</span>
              <div className="min-w-0 flex-1">
                <SearchableSelect
                  value={String(s.from)}
                  onChange={(v) => setStep(i, { from: Number(v) || 0 })}
                  options={monthOptions}
                />
              </div>
              <div className="w-28 shrink-0">
                <Pct value={s.pct} onChange={(pct) => setStep(i, { pct })} />
              </div>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => set({ da: pay.da.filter((_, j) => j !== i) })}
                title="Remove this DA rate"
                aria-label="Remove this DA rate"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="soft"
            size="sm"
            type="button"
            onClick={() =>
              set({
                da: [...pay.da, { from: pay.da.length ? nextFrom : 0, pct: pay.da[pay.da.length - 1]?.pct ?? 0 }],
                // A first rate starts the employee on the standard 10% NPS.
                nps_pct: pay.da.length ? pay.nps_pct : pay.nps_pct || 10,
              })
            }
          >
            <Plus className="h-4 w-4" /> {pay.da.length ? "Add DA revision" : "Add DA rate"}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 self-start">
          <Pct label="HRA % of Basic" value={pay.hra_pct} onChange={(hra_pct) => set({ hra_pct })} />
          <Pct
            label="NPS % of Basic + DA"
            hint="0 if not under NPS"
            value={pay.nps_pct}
            onChange={(nps_pct) => set({ nps_pct })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Button variant="outline" size="sm" type="button" onClick={detect}>
          <Wand2 className="h-4 w-4" /> Detect from salary
        </Button>
        <Button size="sm" type="button" onClick={apply} disabled={!pay.da.length}>
          <Calculator className="h-4 w-4" /> Apply to months
        </Button>
        <div className="min-w-[16rem] flex-1 sm:max-w-sm">
          <CheckToggle
            checked={includeSlips}
            onChange={setIncludeSlips}
            label="Also recalculate months read from slips"
            hint="Off: the real slip figures are kept"
          />
        </div>
      </div>
    </FormSection>
  );
}
