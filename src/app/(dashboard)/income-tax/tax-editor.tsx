"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CheckToggle } from "@/components/ui/check-toggle";
import { FormSection } from "@/components/ui/form-section";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api-client";
import type { StaffOption } from "@/lib/staff-queries";
import type { Statement } from "@/lib/income-tax-queries";
import { applySlips } from "@/lib/salary-slip";
import {
  CHAPTER6_FIELDS,
  DEFAULT_FY,
  FLAG_FIELDS,
  FORM12BB_FIELDS,
  FY_OPTIONS,
  HOUSE_TYPE_OPTIONS,
  INCOME_FIELDS,
  MEDICLAIM_FIELDS,
  OTHER_DETAIL_FIELDS,
  REGIMES,
  REGIME_LABEL,
  SEC16_FIELDS,
  SEC80C_FIELDS,
  TAX_CATEGORY_OPTIONS,
  compareRegimes,
  defaultMonthsRemaining,
  detectPayRates,
  emptyTaxData,
  fyOfMonth,
  inr,
  isValidPan,
  money,
  salaryMonths,
  toTaxCategory,
  type FlagKey,
  type Form12bbKey,
  type HouseType,
  type TaxData,
} from "@/lib/income-tax";
import { Computed, LineItems, Money, MoneyFields } from "./editor-fields";
import RegimeCompare from "./regime-compare";
import PayRates from "./pay-rates";
import SalaryGrid from "./salary-grid";
import SlipUpload, { type UploadedSlip } from "./slip-upload";

type Header = Omit<Statement, "id" | "data">;

const STEPS = [
  { key: "employee", label: "Employee" },
  { key: "salary", label: "Salary Details" },
  { key: "other", label: "Other Details" },
  { key: "income", label: "Other Incomes" },
  { key: "deductions", label: "Deductions" },
  { key: "mediclaim", label: "Mediclaim" },
  { key: "paid", label: "Tax Paid" },
  { key: "12bb", label: "Form 12BB" },
] as const;
type Step = (typeof STEPS)[number]["key"];

type NumberGroup = "other_details" | "deductions" | "mediclaim" | "income";

export default function TaxEditor({
  staff,
  years,
  initial,
}: {
  staff: StaffOption[];
  /** Unlocked financial years, newest first — the only ones a save may target. */
  years: string[];
  initial?: Statement;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!initial;
  const fyOptions = FY_OPTIONS.filter((o) => years.includes(o.value));
  const firstYear = years.includes(DEFAULT_FY) ? DEFAULT_FY : years[0];

  const [head, setHead] = useState<Header>({
    financial_year: initial?.financial_year ?? firstYear,
    staff_id: initial?.staff_id ?? "",
    employee_name: initial?.employee_name ?? "",
    designation: initial?.designation ?? "",
    pan: initial?.pan ?? "",
    pen: initial?.pen ?? "",
    father_name: initial?.father_name ?? "",
    office: initial?.office ?? "",
    category: initial?.category ?? "GENERAL",
    regime: initial?.regime ?? "NEW",
  });
  const [data, setData] = useState<TaxData>(
    () => initial?.data ?? { ...emptyTaxData(), months_remaining: defaultMonthsRemaining(firstYear) }
  );
  const [step, setStep] = useState<Step>(editing ? "salary" : "employee");
  const [slipFiles, setSlipFiles] = useState<File[]>([]);
  const [slipNote, setSlipNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setH = (patch: Partial<Header>) => setHead((h) => ({ ...h, ...patch }));
  const setD = (patch: Partial<TaxData>) => setData((d) => ({ ...d, ...patch }));
  const setIn = <G extends NumberGroup>(group: G, key: keyof TaxData[G], value: number) =>
    setData((d) => ({ ...d, [group]: { ...d[group], [key]: value } }));
  const setFlag = (key: FlagKey, on: boolean) => setData((d) => ({ ...d, flags: { ...d.flags, [key]: on } }));
  const set12 = (key: Form12bbKey, v: string) => setData((d) => ({ ...d, form12bb: { ...d.form12bb, [key]: v } }));

  const preview = useMemo(
    () => compareRegimes(data, head.category, head.financial_year),
    [data, head.category, head.financial_year]
  );
  const old = preview.OLD;
  const panBad = !!head.pan && !isValidPan(head.pan);
  const months = salaryMonths(head.financial_year);
  const flag = (key: FlagKey) => {
    const f = FLAG_FIELDS.find((x) => x.key === key)!;
    return <CheckToggle checked={data.flags[key]} onChange={(on) => setFlag(key, on)} label={f.label} hint={f.hint} />;
  };

  /** Fill the statement from parsed slips — figures, projection and blank header fields. */
  const onSlips = (slips: UploadedSlip[], files: File[]) => {
    // A new statement follows the slips' year when they all share one open year.
    const slipYears = [...new Set(slips.map((s) => fyOfMonth(s.month, s.year)))];
    const fy =
      !editing && slipYears.length === 1 && years.includes(slipYears[0]) ? slipYears[0] : head.financial_year;
    const result = applySlips(data, fy, slips);
    // The slips show the rates in force — take them unless rates are already set.
    setData(
      result.data.pay_rates.da.length
        ? result.data
        : {
            ...result.data,
            // Only real slips count; other months are blanked (not dropped) so
            // each DA change keeps the month it happened in.
            pay_rates: detectPayRates(result.data.months.map((m) => (m.src === "slip" ? m : { ...m, basic: 0 }))),
          }
    );

    const latest = slips[slips.length - 1];
    const match =
      staff.find((s) => s.code && s.code === latest.pen) ??
      staff.find((s) => s.name.toLowerCase() === latest.name.toLowerCase());
    setH({
      financial_year: fy,
      employee_name: head.employee_name || latest.name,
      pen: head.pen || latest.pen,
      designation: head.designation || latest.designation,
      office: head.office || latest.office,
      staff_id: head.staff_id || match?.value || "",
    });
    if (result.filled.length) setSlipFiles((prev) => [...prev, ...files]);

    const parts = [
      result.filled.length && `Filled ${result.filled.join(", ")} from the slips.`,
      result.projected.length && `Projected ${result.projected.join(", ")} from the latest slip.`,
      result.otherYear.length && `Skipped ${result.otherYear.join(", ")} — not in FY ${fy}.`,
      ...slips.filter((s) => s.warning).map((s) => `${s.file}: ${s.warning}`),
    ].filter(Boolean) as string[];
    setSlipNote(parts.join(" "));
    if (result.filled.length) toast.success(`Read ${result.filled.length} salary slip${result.filled.length === 1 ? "" : "s"}`);
    else toast.warning(`None of the slips belong to FY ${fy}.`);
  };

  const save = async () => {
    setError(null);
    if (!head.employee_name.trim()) {
      setStep("employee");
      return setError("Employee name is required.");
    }
    if (panBad) {
      setStep("employee");
      return setError("PAN must look like ABCDE1234F.");
    }
    setSaving(true);
    const result = await apiRequest<{ data?: { id: number } }>("/api/income-tax", {
      method: editing ? "PUT" : "POST",
      body: { id: initial?.id, ...head, staff_id: head.staff_id || null, data },
    });
    if (!result.success) {
      setSaving(false);
      setError(result.message);
      toast.error(result.message);
      return;
    }
    const id = initial?.id ?? result.data?.data?.id;

    // The slips the figures came from go on file with the statement.
    if (id && slipFiles.length) {
      const fd = new FormData();
      fd.append("owner_type", "INCOME_TAX");
      fd.append("owner_id", String(id));
      fd.append("category", "SALARY_SLIP");
      slipFiles.forEach((f) => fd.append("file", f));
      const attached = await apiRequest("/api/attachment", { method: "POST", body: fd });
      if (!attached.success) toast.warning(`Statement saved, but the slips were not attached: ${attached.message}`);
    }
    setSaving(false);
    toast.success(result.message || "Statement saved");
    router.push(id ? `/income-tax/${id}` : "/income-tax");
    router.refresh();
  };

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const go = (delta: number) => setStep(STEPS[Math.min(STEPS.length - 1, Math.max(0, stepIdx + delta))].key);
  const twoCol = "grid grid-cols-1 gap-4 sm:grid-cols-2";

  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="min-w-0">
        <CardHeader className="flex-wrap gap-2">
          <CardTitle>
            {editing ? "Edit" : "New"} Anticipatory Income Tax
            {head.employee_name && <span className="font-normal text-muted"> · {head.employee_name}</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(editing ? `/income-tax/${initial!.id}` : "/income-tax")}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : editing ? "Update" : "Save"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={step === s.key}
                onClick={() => setStep(s.key)}
                className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  step === s.key
                    ? "border-accent/60 bg-accent-soft text-accent-fg"
                    : "border-line bg-elevated text-muted hover:text-fg"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    step === s.key ? "bg-accent-duo text-white" : "bg-card text-faint"
                  }`}
                >
                  {i + 1}
                </span>
                {s.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
              {error}
            </div>
          )}

          {step === "employee" && (
            <FormSection title="Employee details">
              <div className="sm:col-span-2">
                <Label>Staff register</Label>
                <SearchableSelect
                  value={head.staff_id}
                  onChange={(v) => {
                    const s = staff.find((x) => x.value === v);
                    setH({
                      staff_id: v,
                      employee_name: s?.name ?? head.employee_name,
                      designation: s?.designation || head.designation,
                      pen: head.pen || s?.code || "",
                    });
                  }}
                  options={staff}
                  placeholder="Pick from the staff register…"
                />
              </div>
              <div>
                <Label>PEN</Label>
                <Input value={head.pen} maxLength={20} onChange={(e) => setH({ pen: e.target.value.trim() })} />
              </div>
              <div>
                <Label>PAN</Label>
                <Input
                  value={head.pan}
                  maxLength={10}
                  onChange={(e) => setH({ pan: e.target.value.toUpperCase().replace(/\s/g, "") })}
                  placeholder="ABCDE1234F"
                  className={panBad ? "border-red-500" : ""}
                />
                {panBad && <p className="mt-1 text-xs text-red-500">Format: ABCDE1234F</p>}
              </div>
              <div className="sm:col-span-2">
                <Label>
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input value={head.employee_name} onChange={(e) => setH({ employee_name: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Designation</Label>
                <Input value={head.designation} onChange={(e) => setH({ designation: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Father&apos;s name</Label>
                <Input value={head.father_name} onChange={(e) => setH({ father_name: e.target.value })} />
                <p className="mt-1 text-xs text-faint">Printed in the Form 12BB verification</p>
              </div>
              <div className="sm:col-span-2">
                <Label>Office</Label>
                <Input value={head.office} onChange={(e) => setH({ office: e.target.value })} />
              </div>
              <div>
                <Label>Financial year</Label>
                <SearchableSelect
                  value={head.financial_year}
                  onChange={(v) => setH({ financial_year: v || firstYear })}
                  options={fyOptions}
                />
                <p className="mt-1 text-xs text-faint">Only unlocked years are listed</p>
              </div>
              <div>
                <Label>Category</Label>
                <SearchableSelect
                  value={head.category}
                  onChange={(v) => setH({ category: toTaxCategory(v) })}
                  options={TAX_CATEGORY_OPTIONS}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Tax regime opted</Label>
                <div className="grid grid-cols-2 gap-2">
                  {REGIMES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={head.regime === r}
                      onClick={() => setH({ regime: r })}
                      className={`h-9 rounded-[0.65rem] border text-sm font-medium transition-colors ${
                        head.regime === r
                          ? "border-accent/60 bg-accent-soft text-accent-fg"
                          : "border-line bg-elevated text-muted hover:border-faint"
                      }`}
                    >
                      {REGIME_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
            </FormSection>
          )}

          {step === "salary" && (
            <div className="space-y-4">
              <SlipUpload onRead={onSlips} />
              {slipNote && (
                <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-fg">{slipNote}</p>
              )}
              <PayRates
                fy={head.financial_year}
                pay={data.pay_rates}
                months={data.months}
                onPay={(pay_rates) => setD({ pay_rates })}
                onMonths={(m) => setD({ months: m })}
              />
              <FormSection title={`Salary details ${head.financial_year}`} hint="Use ↓ to copy a month downward" className="block">
                <SalaryGrid
                  fy={head.financial_year}
                  months={data.months}
                  salArrear={data.sal_arrear}
                  payRevision={data.pay_revision}
                  onMonths={(m) => setD({ months: m })}
                  onSalArrear={(sal_arrear) => setD({ sal_arrear })}
                  onPayRevision={(pay_revision) => setD({ pay_revision })}
                  pay={data.pay_rates}
                />
              </FormSection>
            </div>
          )}

          {step === "other" && (
            <FormSection title={`Other details ${head.financial_year}`} className={twoCol}>
              <MoneyFields
                fields={OTHER_DETAIL_FIELDS}
                values={data.other_details}
                onChange={(k, v) => setIn("other_details", k, v)}
              />
            </FormSection>
          )}

          {step === "income" && (
            <div className="space-y-6">
              <FormSection title="Income from house property">
                <div className="sm:col-span-2">
                  <Label>Type of house property</Label>
                  <SearchableSelect
                    value={data.house_type}
                    onChange={(v) => setD({ house_type: v as HouseType })}
                    options={HOUSE_TYPE_OPTIONS}
                  />
                </div>
                {data.house_type === "LET_OUT" && (
                  <Money
                    label="Net annual rent"
                    hint="Total annual rent − municipal tax; 30% is deducted"
                    value={data.annual_rent}
                    onChange={(annual_rent) => setD({ annual_rent })}
                  />
                )}
                {data.house_type && (
                  <Money
                    label="Interest on housing loan"
                    hint="Sec 24(b) · self-occupied max ₹2 lakh, old regime only"
                    value={data.housing_interest}
                    onChange={(housing_interest) => setD({ housing_interest })}
                  />
                )}
                {data.house_type && (
                  <Computed
                    label="Income from house property"
                    value={old.house.income}
                    hint={`Old regime · new regime ${inr(preview.NEW.house.income)}`}
                  />
                )}
              </FormSection>
              <FormSection title="Other heads of income">
                <MoneyFields fields={INCOME_FIELDS} values={data.income} onChange={(k, v) => setIn("income", k, v)} />
                <LineItems
                  items={data.other_income}
                  onChange={(other_income) => setD({ other_income })}
                  placeholder="Any other income — specify"
                  addLabel="Any other income"
                />
              </FormSection>
            </div>
          )}

          {step === "deductions" && (
            <div className="space-y-6">
              <FormSection title="Salary deductions & exemptions">
                <MoneyFields
                  fields={SEC16_FIELDS}
                  values={data.deductions}
                  onChange={(k, v) => setIn("deductions", k, v)}
                />
              </FormSection>
              <FormSection
                title="Deductions u/s 80C"
                hint={`80CCE total ${inr(old.total_80cce)} of ₹1,50,000 · old regime`}
              >
                <p className="text-xs text-muted sm:col-span-2 lg:col-span-4">
                  Taken from the salary details automatically: PF {inr(old.sec80c[4]?.amount ?? 0)} · SLI{" "}
                  {inr(old.sec80c[2]?.amount ?? 0)} · GIS {inr(old.sec80c[3]?.amount ?? 0)} · LIC{" "}
                  {inr(old.sec80c[0]?.amount ?? 0)} · NPS {inr(old.nps_total)} (80CCD(1) allowed{" "}
                  {inr(old.nps_allowed)}). Enter only what is <em>not</em> recovered from salary below.
                </p>
                <MoneyFields
                  fields={SEC80C_FIELDS}
                  values={data.deductions}
                  onChange={(k, v) => setIn("deductions", k, v)}
                />
                <LineItems
                  items={data.sec80c_other}
                  onChange={(sec80c_other) => setD({ sec80c_other })}
                  placeholder="Any other deduction u/s 80C — e.g. GPAIS"
                  addLabel="Other 80C item"
                />
              </FormSection>
              <FormSection title="Other deductions" hint="Chapter VI-A · old regime except 80CCD(2)">
                <MoneyFields
                  fields={CHAPTER6_FIELDS}
                  values={data.deductions}
                  onChange={(k, v) => setIn("deductions", k, v)}
                />
                <Computed
                  label="HRA exemption"
                  value={old.hra.exempt}
                  hint={`Least of HRA ${inr(old.hra.received)}, rent − 10% ${inr(old.hra.rent_excess)}, ${Math.round(
                    old.hra.pct * 100
                  )}% ${inr(old.hra.limit)}`}
                />
                {flag("metro")}
                {flag("severe_80dd")}
                {flag("severe_80u")}
                {flag("ddb_senior")}
              </FormSection>
            </div>
          )}

          {step === "mediclaim" && (
            <div className="space-y-6">
              <FormSection title="Self & family (excluding parents)">
                <div className="sm:col-span-2">{flag("self_senior")}</div>
                <Computed label="Medisep deducted from salary" value={old.mediclaim.medisep} hint="From salary details" />
                <MoneyFields
                  fields={MEDICLAIM_FIELDS.self}
                  values={data.mediclaim}
                  onChange={(k, v) => setIn("mediclaim", k, v)}
                />
                <Computed label="Eligible amount" value={old.mediclaim.self} />
              </FormSection>
              <FormSection title="Parents">
                <div className="sm:col-span-2">{flag("parents_senior")}</div>
                <MoneyFields
                  fields={MEDICLAIM_FIELDS.parents}
                  values={data.mediclaim}
                  onChange={(k, v) => setIn("mediclaim", k, v)}
                />
                <Computed label="Eligible amount" value={old.mediclaim.parents} />
              </FormSection>
              <div className="flex items-center justify-between rounded-xl bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-500 ring-1 ring-inset ring-amber-500/25">
                <span>Total eligible u/s 80D</span>
                <span className="tabular-nums">{inr(old.mediclaim.self + old.mediclaim.parents)}</span>
              </div>
            </div>
          )}

          {step === "paid" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FormSection title="TDS from salary" className="block">
                <div className="overflow-hidden rounded-xl border border-line">
                  <table className="w-full text-sm">
                    <thead className="bg-elevated text-xs text-muted">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold">In the pay bill of</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Amount</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.months.map((m, i) => (
                        <tr key={months[i]} className="border-t border-line">
                          <td className="px-3 py-1 font-medium text-fg">{months[i]}</td>
                          <td className="px-2 py-1">
                            <Money
                              value={m.tds}
                              className="h-8"
                              onChange={(tds) =>
                                setD({ months: data.months.map((x, j) => (j === i ? { ...x, tds } : x)) })
                              }
                            />
                          </td>
                          <td className="text-center">
                            {i < 11 && (
                              <button
                                type="button"
                                title={`Copy ${months[i]} TDS to the months below`}
                                aria-label={`Copy ${months[i]} TDS to the months below`}
                                onClick={() =>
                                  setD({ months: data.months.map((x, j) => (j > i ? { ...x, tds: m.tds } : x)) })
                                }
                                className="rounded-md p-1 text-faint hover:bg-accent-soft hover:text-accent"
                              >
                                <ArrowDownToLine className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-line">
                        <td className="px-3 py-1 font-medium text-fg">With other bills</td>
                        <td className="px-2 py-1">
                          <Money
                            value={data.tds_other_bills}
                            className="h-8"
                            onChange={(tds_other_bills) => setD({ tds_other_bills })}
                          />
                        </td>
                        <td />
                      </tr>
                    </tbody>
                    <tfoot className="bg-elevated font-semibold text-fg">
                      <tr>
                        <td className="px-3 py-1.5">Total salary TDS</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {inr(data.months.reduce((a, m) => a + m.tds, 0) + data.tds_other_bills)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </FormSection>
              <div className="space-y-6">
                <FormSection title="Direct payment for this year" className="block">
                  <LineItems
                    items={data.direct_payments}
                    onChange={(direct_payments) => setD({ direct_payments })}
                    placeholder="Challan / receipt no. and date of payment"
                    addLabel="Add payment"
                  />
                </FormSection>
                <FormSection title="TDS by banks on deposit interest" hint="See bank statement or 26AS" className="block">
                  <LineItems
                    items={data.bank_tds}
                    onChange={(bank_tds) => setD({ bank_tds })}
                    placeholder="Name of bank"
                    addLabel="Add bank"
                  />
                </FormSection>
                <FormSection title="Anticipatory deduction" className={twoCol}>
                  <div>
                    <Label>Months left to deduct from</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      step={1}
                      value={data.months_remaining}
                      onChange={(e) =>
                        setD({ months_remaining: Math.min(12, Math.max(1, money(e.target.value) || 1)) })
                      }
                      className="text-right tabular-nums"
                    />
                  </div>
                  <Computed
                    label="Per month (opted regime)"
                    value={preview[head.regime].monthly_tds}
                    hint={`Balance ${inr(preview[head.regime].balance)}`}
                  />
                </FormSection>
              </div>
            </div>
          )}

          {step === "12bb" && (
            <div className="space-y-6">
              <FormSection title="House rent" className={twoCol}>
                <Computed label="Rent paid during the year" value={data.deductions.rent_paid} hint="Entered under Deductions" />
                {FORM12BB_FIELDS.slice(0, 3).map((f) => (
                  <div key={f.key}>
                    <Label>{f.label}</Label>
                    <Input value={data.form12bb[f.key]} onChange={(e) => set12(f.key, e.target.value)} />
                    {f.hint && <p className="mt-1 text-xs text-faint">{f.hint}</p>}
                  </div>
                ))}
              </FormSection>
              <FormSection title="Interest on housing loan" className={twoCol}>
                <Computed label="Interest on housing loan" value={data.housing_interest} hint="Entered under Other Incomes" />
                {FORM12BB_FIELDS.slice(3).map((f) => (
                  <div key={f.key}>
                    <Label>{f.label}</Label>
                    <Input value={data.form12bb[f.key]} onChange={(e) => set12(f.key, e.target.value)} />
                  </div>
                ))}
              </FormSection>
              <FormSection title="Leave travel concession" className={twoCol}>
                <Money label="LTA claimed" value={data.lta} onChange={(lta) => setD({ lta })} />
              </FormSection>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-line pt-4">
            <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={stepIdx === 0}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <span className="text-xs text-faint">
              Step {stepIdx + 1} of {STEPS.length}
            </span>
            {stepIdx < STEPS.length - 1 ? (
              <Button variant="outline" size="sm" onClick={() => go(1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={save} loading={saving}>
                <Save className="h-4 w-4" /> Finish
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="2xl:sticky 2xl:top-4 2xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Tax Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <RegimeCompare
              results={preview}
              selected={head.regime}
              better={preview.better}
              saving={preview.saving}
              onSelect={(regime) => setH({ regime })}
            />
            <p className="mt-3 text-xs text-faint">
              Both columns update as you type. Tap a column to opt for that regime; the printed statement for
              either is on the statement page after saving.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
