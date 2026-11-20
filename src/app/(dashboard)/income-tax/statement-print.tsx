import type { ReactNode } from "react";
import {
  DED_HEADS,
  EARN_HEADS,
  TAX_CATEGORY_SHORT,
  fyHeading,
  rowDeductions,
  rowEarnings,
  salaryMonths,
  shortMonth,
  type HeadKey,
  type SalaryRow,
  type TaxCategory,
  type TaxData,
  type TaxResult,
} from "@/lib/income-tax";

/**
 * The printed statement, laid out like the Kerala "Easy Tax" sheet staff
 * already file — same numbering, same three columns (description, working
 * figure, section total), plain figures without separators, and the same page
 * breaks: the old regime runs to two A4 pages (break after item 7), the new
 * regime fits on one. Presentational only.
 */

export type SheetHeader = {
  employee_name: string;
  designation: string;
  office: string;
  pan: string;
  pen: string;
  father_name: string;
  category: TaxCategory;
  financial_year: string;
};

/** Plain figure, as printed: 611722, -200000. */
const n = (v: number) => String(Math.round(v));

/**
 * One line of the computation. `noSpan` / `outerSpan` let a section number or
 * a section total cover several lines, as on the form; lines covered by an
 * earlier span render no cell of their own.
 */
type Row = {
  no?: string;
  noSpan?: number;
  label: ReactNode;
  inner?: number | null;
  outer?: number | null;
  outerSpan?: number;
  outerAlign?: "top" | "middle" | "bottom";
  bold?: boolean;
  /** Centred label — the "Total …" lines. */
  center?: boolean;
  /** Indent level for sub-items. */
  indent?: 1 | 2 | 3;
  /** No rule under this line (the HRA a), b), c) working). */
  flat?: boolean;
};

/** A numbered section: the number cell spans all of its lines. */
const section = (no: string, rows: Row[]): Row[] =>
  rows.map((r, i) => (i === 0 ? { ...r, no, noSpan: rows.length } : r));

function Computation({ rows }: { rows: Row[] }) {
  let noLeft = 0;
  let outerLeft = 0;
  return (
    <table className="it-calc">
      <colgroup>
        <col style={{ width: "6%" }} />
        <col />
        <col style={{ width: "12%" }} />
        <col style={{ width: "13%" }} />
      </colgroup>
      <tbody>
        {rows.map((r, i) => {
          const showNo = noLeft === 0;
          if (showNo) noLeft = r.noSpan ?? 1;
          noLeft--;
          const showOuter = outerLeft === 0;
          if (showOuter) outerLeft = r.outerSpan ?? 1;
          outerLeft--;
          return (
            <tr key={i} className={r.flat ? "flat" : undefined}>
              {showNo && (
                <td rowSpan={r.noSpan ?? 1} className="no">
                  {r.no}
                </td>
              )}
              <td
                className={`desc${r.bold ? " b" : ""}${r.center ? " c" : ""}`}
                style={r.indent ? { paddingLeft: `${r.indent * 1.6}em` } : undefined}
              >
                {r.label}
              </td>
              <td className="inner">{r.inner == null ? "" : n(r.inner)}</td>
              {showOuter && (
                <td
                  rowSpan={r.outerSpan ?? 1}
                  className={`outer${r.bold ? " b" : ""}`}
                  style={{ verticalAlign: r.outerAlign ?? "bottom" }}
                >
                  {r.outer == null ? "" : n(r.outer)}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** A label with a small figure at its right — the HRA a), b), c) working. */
const Working = ({ label, value }: { label: string; value: number }) => (
  <span className="flex justify-between gap-4">
    <span>{label}</span>
    <span className="w-20 pr-2 text-right">{n(value)}</span>
  </span>
);

/** Items 2 to 5 — the other heads, under one total as on the form. */
function otherHeads(r: TaxResult, data: TaxData, old: boolean): Row[] {
  const type = r.house.type === "SELF" ? "Self-occupied" : r.house.type === "LET_OUT" ? "Let out" : "";
  const anyOther = data.other_income.map((x) => x.label).filter(Boolean).join(", ");
  const total = r.house.income + r.business + r.capital_gains + r.other_sources;
  const rows: Row[] = [
    ...section("2", [
      {
        label: (
          <span>
            Income from House Property ({type})
            <span className="ml-6">{n(r.house.annual_rent)}</span>
          </span>
        ),
        outer: total,
        outerSpan: 8,
        outerAlign: "middle",
        flat: true,
      },
      { label: "(Net Annual Rent - Municipal Tax) -30% - Interest on Housing Loan", flat: true },
      {
        label: old ? "Max Loss Allowed 2Lac" : "In New Regime, Loss can't be set off from other heads of Income",
        inner: r.house.income,
        indent: old ? 1 : undefined,
      },
    ]),
    ...section("3", [{ label: "Income from Business", inner: r.business }]),
    ...section("4", [{ label: "Income from Capital Gains", inner: r.capital_gains }]),
    ...section("5", [
      {
        label: (
          <span className="flex justify-between gap-4">
            <span>Income from Other Sources :</span>
            <span className="w-[45%]">Interest on Savings Bank Deposits</span>
          </span>
        ),
        inner: r.sb_interest,
      },
      {
        label: (
          <span className="flex justify-end">
            <span className="w-[45%]">Interest on Fixed / Term Deposits</span>
          </span>
        ),
        inner: r.fd_interest,
      },
      {
        label: <span className="ml-[22%]">Any Other - {anyOther}</span>,
        inner: data.other_income.reduce((a, x) => a + x.amount, 0),
      },
    ]),
  ];
  return rows;
}

function taxLines(r: TaxResult, first: number, labels: string[]): Row[] {
  const values = [
    r.slab_tax,
    r.rebate_87a,
    r.after_rebate + r.surcharge,
    r.cess,
    r.total_tax,
    r.relief_89,
    r.net_tax,
    r.tax_paid,
    Math.abs(r.balance),
  ];
  // Overpaid: the last line reports the refund instead of a nil balance.
  const text = (label: string, i: number) =>
    i === labels.length - 1 && r.balance < 0 ? "Excess Tax Paid (Refund due)" : label;
  return labels.map((label, i) =>
    section(String(first + i), [{ label: text(label, i), outer: values[i], bold: i === labels.length - 1 }])[0]
  );
}

function oldRegimeRows(r: TaxResult, data: TaxData): { page1: Row[]; page2: Row[] } {
  const pct = Math.round(r.hra.pct * 100);
  // As on the form, the HRA working is only filled in when rent is paid.
  const rentPaid = data.deductions.rent_paid > 0;
  const hra = rentPaid ? r.hra : { received: 0, rent_excess: 0, limit: 0 };
  const sec1: Row[] = [
    { label: "i) Gross Salary (a+b+c)", outer: r.gross_salary, outerSpan: 4, outerAlign: "top" },
    { label: "a)  Salary as per Section 17(1)", inner: r.salary_17_1, indent: 1 },
    { label: "b)  Value of Perquisites", inner: r.perquisites, indent: 1 },
    { label: "c)  Profits in lieu of salary under section 17(3)", inner: r.profits_in_lieu, indent: 1 },
    { label: "Less Recoveries Like Dies Non, Excess Pay Drawn, etc", inner: r.recoveries, outer: r.balance_salary, outerSpan: 2 },
    { label: "Balance", indent: 1 },
    {
      label: "ii) Less Allowances to the extent exempt u/s 10 (First included it in salary)",
      outer: r.total_exempt,
      outerSpan: 7,
      flat: true,
    },
    { label: "HRA in the case of persons who actually incur expenditure by way of Rent", indent: 1, flat: true },
    { label: <Working label="a)  Actual HRA Received" value={hra.received} />, indent: 2, flat: true },
    { label: <Working label="b)  Rent paid in excess 1/10th of the salary" value={hra.rent_excess} />, indent: 2, flat: true },
    { label: <Working label={`c)  ${pct}% of Salary (Salary means Basic + DA)`} value={hra.limit} />, indent: 2, flat: true },
    { label: "(a) to (c) whichever is least is exempted", inner: r.hra.exempt, indent: 3, flat: true },
    { label: "Other Allowances to the extent exempt u/s 10", inner: r.other_exempt, indent: 1 },
    { label: "iii) Net Salary ( i-ii)", outer: r.net_salary },
    { label: "iv) Deduction u/s 16  (iv-a + iv-b + iv-c )", outer: r.total_sec16, outerSpan: 4, outerAlign: "top", flat: true },
    { label: "a) Standard Deduction", inner: r.standard_deduction, indent: 3, flat: true },
    { label: "b) Entertainment Allowance", inner: r.entertainment, indent: 3, flat: true },
    { label: "c) Professional Tax", inner: r.professional_tax, indent: 3 },
    { label: "v)  Income Chargeable under the head Salaries (iii-iv)", outer: r.income_from_salary, bold: true },
  ];
  const sec7: Row[] = [
    { label: "A - Deduction under section 80C", outer: r.total_80cce, outerSpan: r.sec80c.length + 4 },
    ...r.sec80c.map((x) => ({ label: x.label, inner: x.amount, indent: 1 as const })),
    { label: "B  Contribution to Pension Fund (80CCC)", inner: r.sec80ccc },
    {
      label: `C  NPS (Total :${n(r.nps_total)}). Deduction U/s 80CCD(1) (Max.10% of Basic+DA of this Yr)`,
      inner: r.nps_allowed,
    },
    { label: `Total Deduction u/s 80 CCE (A+B+C) =${n(r.total_80cce)}`, bold: true, center: true },
  ];
  const last = String.fromCharCode(96 + r.chapter6.length);
  const sec8: Row[] = [
    ...r.chapter6.map((x) => ({ label: x.label, outer: x.amount })),
    { label: `Total of (a) to (${last})`, outer: r.total_chapter6, bold: true, center: true },
  ];
  return {
    page1: [
      ...section("1", sec1),
      ...otherHeads(r, data, true),
      ...section("6", [{ label: "Gross Total Income (Total of 1 to 5)", outer: r.gross_total_income, bold: true }]),
      ...section("7", sec7),
    ],
    page2: [
      ...section("8", sec8),
      ...section("9", [{ label: "Total Deduction  (7+8)", outer: r.total_deductions, bold: true, center: true }]),
      ...section("10", [
        {
          label: "Total Income (6-9)  (Rounded to the nearest multiple of ten as per Sec. 288 A )",
          outer: r.taxable_income,
          bold: true,
        },
      ]),
      ...taxLines(r, 11, [
        "Tax on Total Income",
        "Less : Rebate u/s 87A",
        "Income Tax after Rebate",
        "Health and  Education cess @ 4% of 13",
        "Total Tax Payable (13+14)",
        "Less : Relief for Arrears of Salary u/s 89(1)",
        "Balance Tax Payable (15-16)",
        "Total Amount of Tax already deducted",
        "Balance Tax to be paid",
      ]),
    ],
  };
}

function newRegimeRows(r: TaxResult, data: TaxData): Row[] {
  const sec1: Row[] = [
    { label: "i) Gross Salary (a+b+c)", outer: r.gross_salary, outerSpan: 4, outerAlign: "top" },
    { label: "a)  Salary as per Section 17(1)", inner: r.salary_17_1, indent: 1 },
    { label: "b)  Value of Perquisites", inner: r.perquisites, indent: 1 },
    { label: "c)  Profits in lieu of salary under section 17(3)", inner: r.profits_in_lieu, indent: 1 },
    { label: "Less Deduction for Dies non, Excess pay Drawn etc", inner: r.recoveries, outer: r.balance_salary },
    { label: "Less Standard Deduction", inner: r.standard_deduction, outer: r.income_from_salary },
  ];
  // 80CCD(2) is the one deduction the new regime allows; the form has no line
  // for it, so it appears only when claimed.
  const sec6: Row[] = [
    { label: "Gross Total Income (Total of 1 to 5)", outer: r.gross_total_income, bold: true },
    ...(r.employer_nps
      ? [
          { label: "Less : Employer contribution to NPS u/s 80CCD(2)", outer: r.employer_nps },
          { label: "Total Income (Rounded off as per Sec. 288 A)", outer: r.taxable_income, bold: true },
        ]
      : []),
  ];
  return [
    ...section("1", sec1),
    ...otherHeads(r, data, false),
    ...section("6", sec6),
    ...taxLines(r, 7, [
      "Tax on Total Income",
      "Less : Rebate u/s 87A(1A)(a) or 87A(1A)(b)",
      "Income Tax after Rebate",
      "Health and  Education cess @ 4% of 9",
      "Total Tax Payable (9+10)",
      "Less : Relief for Arrears of Salary u/s 89(1)",
      "Balance Tax Payable",
      "Total Amount of Tax already deducted",
      "Balance Tax to be paid",
    ]),
  ];
}

/** The salary particulars table under the signature. */
function SalaryParticulars({ fy, data }: { fy: string; data: TaxData }) {
  const months = salaryMonths(fy).map(shortMonth);
  const od = data.other_details;
  type Line = { label: string; row: Partial<SalaryRow>; gross?: number; wide?: boolean; blankZero?: boolean };
  const lines: Line[] = [
    ...data.months.map((m, i) => ({ label: months[i], row: m as Partial<SalaryRow> })),
    { label: "Sal.Arr", row: data.sal_arrear, blankZero: true },
    { label: "DA Arr", row: { pf: od.da_arrear_pf }, gross: od.da_arrear, blankZero: true },
    { label: "PR Arr", row: data.pay_revision, blankZero: true },
    { label: "Earned Leave Surrender", row: { pf: od.leave_surrender_pf }, gross: od.leave_surrender, wide: true, blankZero: true },
    { label: "Festival Allowance", row: {}, gross: od.festival_allowance, wide: true, blankZero: true },
  ];
  const full = (row: Partial<SalaryRow>) =>
    Object.fromEntries([...EARN_HEADS, ...DED_HEADS].map((h) => [h.key, row[h.key] ?? 0])) as SalaryRow;
  const grossOf = (l: Line) => l.gross ?? rowEarnings(full(l.row));
  const dedOf = (l: Line) => rowDeductions(full(l.row));
  const colTotal = (k: HeadKey) => lines.reduce((a, l) => a + (l.row[k] ?? 0), 0);
  const cell = (l: Line, v: number | undefined) => (l.blankZero && !v ? "" : n(v ?? 0));
  const extraRows = lines.length - 12;

  return (
    <div className="it-keep">
      <div className="text-center font-bold">SALARY PARTICULARS - {fy}</div>
      <table className="it-grid">
        <thead>
          <tr>
            <th>Month</th>
            {EARN_HEADS.map((h) => (
              <th key={h.key}>{h.key === "other" ? "Other" : h.label}</th>
            ))}
            <th>Gross</th>
            {DED_HEADS.map((h) => (
              <th key={h.key}>{h.key === "medisep" ? "M.Sep" : h.label}</th>
            ))}
            <th>Ded</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.label} className={i >= 12 && i < 12 + extraRows ? "extra" : undefined}>
              {l.wide ? (
                <td colSpan={EARN_HEADS.length + 1} className="lbl wide">
                  {l.label}
                </td>
              ) : (
                <>
                  <td className="lbl">{l.label}</td>
                  {EARN_HEADS.map((h) => (
                    <td key={h.key}>{cell(l, l.row[h.key])}</td>
                  ))}
                </>
              )}
              <td>{n(grossOf(l))}</td>
              {DED_HEADS.map((h) => (
                <td key={h.key}>{cell(l, l.row[h.key])}</td>
              ))}
              <td>{l.wide ? "" : n(dedOf(l))}</td>
            </tr>
          ))}
          <tr className="tot">
            <td className="lbl">Total</td>
            {EARN_HEADS.map((h) => (
              <td key={h.key}>{n(colTotal(h.key))}</td>
            ))}
            <td>{n(lines.reduce((a, l) => a + grossOf(l), 0))}</td>
            {DED_HEADS.map((h) => (
              <td key={h.key}>{n(colTotal(h.key))}</td>
            ))}
            <td>{n(lines.reduce((a, l) => a + dedOf(l), 0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TaxAlreadyPaid({ fy, data }: { fy: string; data: TaxData }) {
  const months = salaryMonths(fy).map(shortMonth);
  const total = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);
  const cols: [string, number][] = [
    ...data.months.map((m, i) => [months[i], m.tds] as [string, number]),
    ["Other", data.tds_other_bills],
    ["Direct", total(data.direct_payments)],
    ["Bank", total(data.bank_tds)],
  ];
  return (
    <div className="it-keep">
      <div className="text-[1.15em] font-bold">Details of Tax already paid</div>
      <table className="it-grid paid">
        <thead>
          <tr>
            {cols.map(([l]) => (
              <th key={l}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {cols.map(([l, v]) => (
              <td key={l}>{v ? n(v) : ""}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const officeLine = (h: SheetHeader) =>
  `${(h.designation || "").toUpperCase()}, ${h.office ? h.office.toUpperCase() : "...................."}`;

/** Title block: heading left, regime badge right, then name / designation with PAN / category. */
function SheetHead({ header, regime }: { header: SheetHeader; regime: "Old Regime" | "New Regime" }) {
  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <div className="it-title">Income Tax Statement</div>
          <div className="it-subtitle">{fyHeading(header.financial_year)}</div>
        </div>
        <span className="it-badge">{regime}</span>
      </div>
      <div className="mb-1 mt-2 grid grid-cols-[1fr_auto] items-end gap-x-6">
        <div>
          <span className="inline-block w-36">Name of Employee :</span>
          <strong className="text-[1.15em]">{header.employee_name.toUpperCase()}</strong>
        </div>
        <div>
          PAN : <strong className="text-[1.15em]">{header.pan || "...................."}</strong>
        </div>
        <div>
          <span className="inline-block w-36">Designation &amp; Office :</span>
          <strong className="text-[1.15em]">{officeLine(header)}</strong>
        </div>
        <div>Cat: &nbsp;&nbsp;{TAX_CATEGORY_SHORT[header.category]}</div>
      </div>
    </>
  );
}

function Signature({ header, printedAt }: { header: SheetHeader; printedAt: string }) {
  return (
    <div className="it-keep my-5 grid grid-cols-2 items-end">
      <div>
        <div>........................</div>
        <div className="mt-2 font-bold">{printedAt.split(" ")[0]}</div>
      </div>
      <div className="pl-[20%]">
        <div>Signature</div>
        <div className="mt-1">{header.employee_name.toUpperCase()}</div>
      </div>
    </div>
  );
}

function Footer({ printedAt, credit }: { printedAt: string; credit: string }) {
  return (
    <div className="mt-3 flex items-end justify-between">
      <span>Printed on {printedAt}</span>
      <span className="text-[0.85em]">{credit}</span>
    </div>
  );
}

/** The tail every statement ends with: signature, salary particulars, tax paid. */
function Particulars({
  header,
  data,
  printedAt,
  credit,
}: {
  header: SheetHeader;
  data: TaxData;
  printedAt: string;
  credit: string;
}) {
  return (
    <>
      <Signature header={header} printedAt={printedAt} />
      <SalaryParticulars fy={header.financial_year} data={data} />
      <div className="mt-2">
        <TaxAlreadyPaid fy={header.financial_year} data={data} />
      </div>
      <Footer printedAt={printedAt} credit={credit} />
    </>
  );
}

/** One regime's statement as A4 pages: two for the old regime, one for the new. */
export function StatementPages({
  header,
  data,
  result,
  printedAt,
  credit,
}: {
  header: SheetHeader;
  data: TaxData;
  result: TaxResult;
  printedAt: string;
  /** Small text at the bottom right of the last page. */
  credit: string;
}) {
  if (result.regime === "OLD") {
    const { page1, page2 } = oldRegimeRows(result, data);
    return (
      <>
        <div className="it-page">
          <SheetHead header={header} regime="Old Regime" />
          <Computation rows={page1} />
        </div>
        <div className="it-page">
          <Computation rows={page2} />
          <Particulars header={header} data={data} printedAt={printedAt} credit={credit} />
        </div>
      </>
    );
  }
  return (
    <div className="it-page">
      <SheetHead header={header} regime="New Regime" />
      <Computation rows={newRegimeRows(result, data)} />
      <Particulars header={header} data={data} printedAt={printedAt} credit={credit} />
    </div>
  );
}

/** Form 12BB — the claims, with the landlord / lender particulars behind them. */
export function Form12bbPage({
  header,
  data,
  result,
  printedAt,
}: {
  header: SheetHeader;
  data: TaxData;
  /** Old-regime working: it lists every claim the employee makes. */
  result: TaxResult;
  printedAt: string;
}) {
  const f = data.form12bb;
  const strip = (s: string) => s.replace(/^[a-z]\)\s*/, "");
  const rows: { no?: string; label: ReactNode; amount?: number | null; evidence?: string }[] = [
    { no: "1", label: <strong>House Rent Allowance</strong> },
    { label: "(i) Rent paid to the landlord", amount: data.deductions.rent_paid },
    { label: "(ii) Name of the landlord", evidence: f.landlord_name },
    { label: "(iii) Address of the landlord", evidence: f.landlord_address },
    { label: "(iv) Permanent Account Number of the landlord", evidence: f.landlord_pan },
    { no: "2", label: <strong>Leave travel concessions or assistance</strong>, amount: data.lta },
    { no: "3", label: <strong>Deduction of interest on borrowing</strong> },
    { label: "(i) Interest payable / paid to the lender", amount: data.housing_interest },
    { label: "(ii) Name of the lender", evidence: f.lender_name },
    { label: "(iii) Address of the lender", evidence: f.lender_address },
    { label: "(iv) Permanent Account Number of the lender", evidence: f.lender_pan },
    { no: "4", label: <strong>Deductions under Chapter VI-A</strong> },
    { label: "(A) Sections 80C, 80CCC and 80CCD" },
    ...result.sec80c
      .filter((x) => x.amount)
      .map((x) => ({ label: `Section 80C — ${strip(x.label)}`, amount: x.amount })),
    { label: "Section 80CCC", amount: result.sec80ccc },
    { label: "Section 80CCD(1) — NPS", amount: result.nps_allowed },
    { label: "(B) Other sections (e.g. 80E, 80G, 80TTA) under Chapter VI-A" },
    ...result.chapter6.filter((x) => x.amount).map((x) => ({ label: strip(x.label), amount: x.amount })),
  ];
  return (
    <div className="it-page">
      <div className="text-center">
        <div className="it-title">FORM NO. 12BB</div>
        <div>(See rule 26C)</div>
        <div className="font-bold">Statement showing particulars of claims by an employee for deduction of tax</div>
      </div>
      <table className="it-calc my-3">
        <tbody>
          {(
            [
              ["1", "Name and address of the employee", `${header.employee_name.toUpperCase()}, ${officeLine(header)}`],
              ["2", "Permanent Account Number of the employee", header.pan || "—"],
              ["3", "Financial year", header.financial_year],
            ] as const
          ).map(([no, label, value]) => (
            <tr key={no}>
              <td className="no">{no}</td>
              <td className="desc">{label}</td>
              <td className="desc b">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mb-1 text-center font-bold">Details of claims and evidence thereof</div>
      <table className="it-calc">
        <thead>
          <tr>
            <th style={{ width: "6%" }}>Sl.</th>
            <th>Nature of claim</th>
            <th style={{ width: "14%" }}>Amount (Rs.)</th>
            <th style={{ width: "28%" }}>Evidence / particulars</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="no">{r.no}</td>
              <td className="desc">{r.label}</td>
              <td className="outer">{r.amount == null ? "" : n(r.amount)}</td>
              <td className="desc">{r.evidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="it-keep mt-4 space-y-2">
        <div className="text-center font-bold">Verification</div>
        <p>
          I, <strong>{header.employee_name.toUpperCase()}</strong>
          {header.father_name ? `, son / daughter of ${header.father_name.toUpperCase()}` : ""}, do hereby certify
          that the information given above is complete and correct.
        </p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 pt-8">
          <div>Place : {header.office || "......................"}</div>
          <div className="text-right">(Signature of the employee)</div>
          <div>Date : {printedAt.split(" ")[0]}</div>
          <div className="text-right">Designation : {header.designation || "—"}</div>
          <div />
          <div className="text-right">Full Name : {header.employee_name.toUpperCase()}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Paper styling. A sheet is ink on paper in either theme — it previews as the
 * PDF will print — so it uses fixed paper colours rather than theme tokens.
 * System fonts only (no font import): Calibri where Windows has it.
 */
export function SheetStyle() {
  return (
    <style>{`
      .it-page {
        width: 210mm; min-height: 297mm; margin: 0 auto 16px; padding: 11mm 12mm;
        background: #fff; color: #111; box-shadow: 0 2px 14px rgb(0 0 0 / .25);
        font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; font-size: 12.5px; line-height: 1.3;
      }
      .it-title { font-family: Bahnschrift, "Arial Narrow", "Roboto Condensed", Calibri, sans-serif;
        font-stretch: 75%; font-size: 2.3em; font-weight: 400; line-height: 1.05; }
      .it-subtitle { font-family: Bahnschrift, "Arial Narrow", Calibri, sans-serif; font-stretch: 75%;
        font-size: 1.5em; line-height: 1.1; }
      .it-badge { background: #111; color: #fff; padding: 3px 12px; font-weight: 700; font-size: 1.15em;
        -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .it-calc { width: 100%; border-collapse: collapse; border: 1.5px solid #111; }
      .it-calc td, .it-calc th { border: 1px solid #111; padding: 1px 5px; vertical-align: top; }
      .it-calc td.no { text-align: center; }
      .it-calc td.desc { border-left: 1px solid #111; }
      .it-calc td.inner, .it-calc td.outer { text-align: right; white-space: nowrap; }
      .it-calc td.outer { border-left: 1.5px solid #111; }
      .it-calc tr.flat > td.desc, .it-calc tr.flat > td.inner { border-bottom-color: transparent; }
      .it-calc .b { font-weight: 700; }
      .it-calc .c { text-align: center; }
      .it-grid { width: 100%; border-collapse: collapse; border: 1.5px solid #111; font-size: 0.95em; }
      .it-grid th { border: 1px solid #111; padding: 0 3px; font-weight: 700; text-align: center; }
      .it-grid td { border-left: 1px solid #111; border-right: 1px solid #111; border-bottom: 1px solid #111;
        padding: 0 3px; text-align: right; }
      .it-grid td.lbl { text-align: left; white-space: nowrap; }
      .it-grid td.wide { padding-left: 10px; }
      .it-grid tr.tot td { border-top: 1.5px solid #111; font-weight: 700; }
      .it-grid.paid td { height: 1.6em; }
      .it-keep { break-inside: avoid; }
      @media print {
        @page { size: A4 portrait; margin: 0; }
        html, body { background: #fff !important; }
        .it-page { margin: 0; box-shadow: none; min-height: 0; break-after: page; }
        .it-page:last-child { break-after: auto; }
        .it-calc tr { break-inside: avoid; }
      }
    `}</style>
  );
}
