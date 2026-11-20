/**
 * Anticipatory income tax — the statement a salaried employee files with the
 * drawing officer so tax can be deducted from salary month by month. Modelled
 * on the Kerala Govt. "Easy Tax" statement: salary March → February with
 * PF / SLI / GIS / LIC / NPS / Medisep recovered from it, salary and pay
 * revision arrears, DA arrears and leave surrender merged to PF, house
 * property, mediclaim, and the Form 12BB particulars.
 *
 * Pure and client-safe: the editor runs it for the live preview, the
 * statement page for the printout, and the API again before saving, so the
 * three can never disagree. No `db` import here — keep it that way.
 *
 * Rates live in RULES, keyed by financial year. Adding a year is adding an
 * entry; nothing else reads a hard-coded rate.
 */

/* ------------------------------------------------------------------ rules */

type Slab = { upto: number; rate: number }; // upto = Infinity for the last band

type RegimeRules = {
  standardDeduction: number;
  /** Section 87A: full rebate up to `upto` taxable income, at most `max`. */
  rebate: { upto: number; max: number; marginalRelief: boolean };
  /** Surcharge bands; the last applicable band wins. */
  surcharge: { over: number; rate: number }[];
  /** Employer NPS (80CCD(2)) as a share of basic + DA. */
  employerNpsPct: number;
};

export type YearRules = {
  label: string;
  cess: number;
  newSlabs: Slab[];
  /** Old regime: basic exemption depends on age; bands above it are shared. */
  oldExemption: Record<TaxCategory, number>;
  oldSlabsAbove: Slab[];
  NEW: RegimeRules;
  OLD: RegimeRules;
  limits: typeof LIMITS;
};

/** Statutory caps on deductions — unchanged across recent years. */
const LIMITS = {
  sec80CCE: 150_000,
  sec80CCD1B: 50_000,
  sec24b: 200_000,
  sec80EE: 50_000,
  sec80EEB: 150_000,
  sec80GG: 60_000,
  sec80D: { normal: 25_000, senior: 50_000 },
  /** Preventive health check-up, inside the 80D limits, self + parents together. */
  checkup: 5_000,
  sec80DD: { normal: 75_000, severe: 125_000 },
  sec80U: { normal: 75_000, severe: 125_000 },
  sec80DDB: { normal: 40_000, senior: 100_000 },
  sec80TTA: 10_000,
  sec80TTB: 50_000,
  professionalTax: 2_500,
  entertainment: 5_000,
  /** Employee NPS under 80CCD(1) — capped at 10% of this year's basic + DA. */
  employeeNpsPct: 0.1,
};

const SURCHARGE_OLD = [
  { over: 5_000_000, rate: 0.1 },
  { over: 10_000_000, rate: 0.15 },
  { over: 20_000_000, rate: 0.25 },
  { over: 50_000_000, rate: 0.37 },
];

/** The old regime has not changed in these years; only the new one moves. */
const OLD_REGIME = {
  oldExemption: { GENERAL: 250_000, SENIOR: 300_000, SUPER_SENIOR: 500_000 },
  oldSlabsAbove: [
    { upto: 500_000, rate: 0.05 },
    { upto: 1_000_000, rate: 0.2 },
    { upto: Infinity, rate: 0.3 },
  ],
  OLD: {
    standardDeduction: 50_000,
    rebate: { upto: 500_000, max: 12_500, marginalRelief: false },
    surcharge: SURCHARGE_OLD,
    employerNpsPct: 0.1,
  },
  cess: 0.04,
  limits: LIMITS,
};

// The new regime caps surcharge at 25%.
const SURCHARGE_NEW = SURCHARGE_OLD.slice(0, 3);

/** Finance Act 2025 slabs — FY 2025-26, carried into 2026-27. */
const NEW_2025: Pick<YearRules, "newSlabs" | "NEW"> = {
  newSlabs: [
    { upto: 400_000, rate: 0 },
    { upto: 800_000, rate: 0.05 },
    { upto: 1_200_000, rate: 0.1 },
    { upto: 1_600_000, rate: 0.15 },
    { upto: 2_000_000, rate: 0.2 },
    { upto: 2_400_000, rate: 0.25 },
    { upto: Infinity, rate: 0.3 },
  ],
  NEW: {
    standardDeduction: 75_000,
    rebate: { upto: 1_200_000, max: 60_000, marginalRelief: true },
    surcharge: SURCHARGE_NEW,
    employerNpsPct: 0.14,
  },
};

/**
 * Keyed by financial year, oldest first — the last entry is the default year.
 * Verify each against that year's Finance Act before relying on it.
 */
export const RULES: Record<string, YearRules> = {
  // Finance (No. 2) Act 2024.
  "2024-25": {
    label: "FY 2024-25 (AY 2025-26)",
    ...OLD_REGIME,
    newSlabs: [
      { upto: 300_000, rate: 0 },
      { upto: 700_000, rate: 0.05 },
      { upto: 1_000_000, rate: 0.1 },
      { upto: 1_200_000, rate: 0.15 },
      { upto: 1_500_000, rate: 0.2 },
      { upto: Infinity, rate: 0.3 },
    ],
    NEW: {
      standardDeduction: 75_000,
      rebate: { upto: 700_000, max: 25_000, marginalRelief: true },
      surcharge: SURCHARGE_NEW,
      employerNpsPct: 0.14,
    },
  },
  // Finance Act 2025.
  "2025-26": { label: "FY 2025-26 (AY 2026-27)", ...OLD_REGIME, ...NEW_2025 },
  // Budget 2026 left the slabs unchanged.
  "2026-27": { label: "FY 2026-27 (AY 2027-28)", ...OLD_REGIME, ...NEW_2025 },
};

export const FINANCIAL_YEARS = Object.keys(RULES);
export const DEFAULT_FY = FINANCIAL_YEARS[FINANCIAL_YEARS.length - 1];
/** Newest first, the order people look for a year in. */
export const FY_OPTIONS = [...FINANCIAL_YEARS]
  .reverse()
  .map((fy) => ({ value: fy, label: RULES[fy].label }));

/**
 * A year with no saved lock setting: the current year is open, past years are
 * locked until someone unlocks them — filed statements should not drift.
 */
export const lockedByDefault = (fy: string) => fy !== DEFAULT_FY;

export const rulesFor = (fy: string): YearRules => RULES[fy] ?? RULES[DEFAULT_FY];

/** "FY 2026-27  AY 2027-28" — the statement heading. */
export function fyHeading(fy: string) {
  const start = Number(fy.slice(0, 4));
  return `FY ${fy}  AY ${start + 1}-${String(start + 2).slice(2)}`;
}

/* ---------------------------------------------------------- vocabulary */

export const REGIMES = ["NEW", "OLD"] as const;
export type Regime = (typeof REGIMES)[number];
export const REGIME_LABEL: Record<Regime, string> = {
  NEW: "New Regime",
  OLD: "Old Regime",
};
export const toRegime = (v: unknown): Regime => (String(v).toUpperCase() === "OLD" ? "OLD" : "NEW");

export const TAX_CATEGORIES = ["GENERAL", "SENIOR", "SUPER_SENIOR"] as const;
export type TaxCategory = (typeof TAX_CATEGORIES)[number];
export const TAX_CATEGORY_LABEL: Record<TaxCategory, string> = {
  GENERAL: "Others (below 60)",
  SENIOR: "Senior Citizen (60 to 79)",
  SUPER_SENIOR: "Super Senior Citizen (80 or more)",
};
/** The short form printed beside PAN — "Cat: Others". */
export const TAX_CATEGORY_SHORT: Record<TaxCategory, string> = {
  GENERAL: "Others",
  SENIOR: "Senior",
  SUPER_SENIOR: "Super Senior",
};
export const TAX_CATEGORY_OPTIONS = TAX_CATEGORIES.map((c) => ({
  value: c,
  label: TAX_CATEGORY_LABEL[c],
}));
export const toTaxCategory = (v: unknown): TaxCategory => {
  const k = String(v ?? "").toUpperCase();
  return (TAX_CATEGORIES as readonly string[]).includes(k) ? (k as TaxCategory) : "GENERAL";
};

const MONTH_NAMES = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];

/** Salary months March → February: "Mar 2026" … "Feb 2027". */
export function salaryMonths(fy: string): string[] {
  const start = Number(fy.slice(0, 4)) || new Date().getFullYear();
  return MONTH_NAMES.map((m, i) => `${m} ${i < 10 ? start : start + 1}`);
}

/** "Mar-26" — the compact label used on the printed salary particulars. */
export const shortMonth = (label: string) => label.replace(/ \d\d(\d\d)$/, "-$1");

/** Index (0 = March) of a calendar month in the financial year, or -1. */
export function fyMonthIndex(fy: string, month: number, year: number): number {
  const start = Number(fy.slice(0, 4));
  if (month >= 3 && year === start) return month - 3;
  if (month <= 2 && year === start + 1) return month + 9;
  return -1;
}

/** The financial year a calendar month's salary belongs to. */
export function fyOfMonth(month: number, year: number): string {
  const start = month >= 3 ? year : year - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

export const EARN_HEADS = [
  { key: "basic", label: "Basic" },
  { key: "da", label: "DA" },
  { key: "hra", label: "HRA" },
  { key: "cca", label: "CCA" },
  { key: "other", label: "Others" },
] as const;
export const DED_HEADS = [
  { key: "pf", label: "PF" },
  { key: "sli", label: "SLI" },
  { key: "gis", label: "GIS" },
  { key: "lic", label: "LIC" },
  { key: "nps", label: "NPS" },
  { key: "medisep", label: "Medisep" },
] as const;
export const SALARY_HEADS = [...EARN_HEADS, ...DED_HEADS];
export type EarnKey = (typeof EARN_HEADS)[number]["key"];
export type DedKey = (typeof DED_HEADS)[number]["key"];
export type HeadKey = EarnKey | DedKey;
export type SalaryRow = Record<HeadKey, number>;

/** Where a month's figures came from — shown as a chip in the salary grid. */
export type MonthSource = "" | "slip" | "projected";
export type MonthRow = SalaryRow & { tds: number; src: MonthSource };

export type LineItem = { label: string; amount: number };

type Field<K extends string> = { key: K; label: string; hint?: string };
const fields = <K extends string>(f: Field<K>[]) => f;

export const OTHER_DETAIL_FIELDS = fields([
  { key: "da_arrear", label: "DA arrears" },
  { key: "da_arrear_pf", label: "DA arrears merged to PF" },
  { key: "leave_surrender", label: "Earned leave surrender" },
  { key: "leave_surrender_pf", label: "Leave surrender merged to PF" },
  { key: "festival_allowance", label: "Festival allowance / Bonus / Ex-gratia / Incentives" },
  { key: "perquisites", label: "Value of perquisites", hint: "Sec 17(2)" },
  { key: "profits_in_lieu", label: "Profits in lieu of salary", hint: "Sec 17(3)" },
]);
export type OtherDetailKey = (typeof OTHER_DETAIL_FIELDS)[number]["key"];

export const SEC16_FIELDS = fields([
  { key: "professional_tax", label: "Professional tax", hint: "Sec 16(iii) · max ₹2,500" },
  { key: "entertainment", label: "Entertainment allowance", hint: "Sec 16(ii) · max ₹5,000" },
  { key: "exempt_allowance", label: "Other allowance exempt u/s 10" },
  { key: "recoveries", label: "Recoveries — dies non, excess pay drawn" },
]);

export const SEC80C_FIELDS = fields([
  { key: "housing_principal", label: "Housing loan principal & stamp duty" },
  { key: "lic_other", label: "LIC / ULIP (other than in salary)" },
  { key: "tax_saver_fd", label: "Tax saver deposit — bank / post office (5 yr+)" },
  { key: "nsc", label: "NSC VIII issue" },
  { key: "nhb", label: "Deposit scheme / pension fund of NHB" },
  { key: "tuition", label: "Tuition fees (up to two children)" },
  { key: "equity", label: "Equity shares / debentures of an eligible issue" },
  { key: "mutual_fund", label: "Eligible units of mutual fund / ELSS" },
  { key: "sec80ccc", label: "80CCC — annuity plan of a pension fund" },
]);

export const CHAPTER6_FIELDS = fields([
  { key: "nps_additional", label: "Additional contribution to NPS", hint: "80CCD(1B) · max ₹50,000" },
  { key: "employer_nps", label: "Employer contribution to NPS", hint: "80CCD(2) · both regimes" },
  { key: "sec80dd", label: "80DD — treatment of a disabled dependant", hint: "₹75,000 / ₹1.25 lakh severe" },
  { key: "sec80ddb", label: "80DDB — specified diseases", hint: "₹40,000 / ₹1 lakh senior" },
  { key: "sec80e", label: "80E — education loan interest" },
  { key: "sec80u", label: "80U — disabled employee", hint: "₹75,000 / ₹1.25 lakh if >80%" },
  { key: "sec80g", label: "80G — donations to notified funds (CMDRF etc.)" },
  { key: "sec80gg", label: "80GG — rent paid, when no HRA is received", hint: "max ₹60,000" },
  { key: "sec80ggc", label: "80GGC — contribution to political parties" },
  { key: "sec80ee", label: "80EE — housing loan interest (2016-17 loans)", hint: "max ₹50,000" },
  { key: "sec80eeb", label: "80EEB — electric vehicle loan interest", hint: "max ₹1.5 lakh" },
  { key: "relief_89_old", label: "Relief u/s 89(1) — old regime", hint: "From Form 10E" },
  { key: "relief_89_new", label: "Relief u/s 89(1) — new regime", hint: "From Form 10E" },
  { key: "rent_paid", label: "Rent paid during the year", hint: "For HRA exemption" },
]);

const DEDUCTION_FIELDS = [...SEC16_FIELDS, ...SEC80C_FIELDS, ...CHAPTER6_FIELDS];
export type DeductionKey = (typeof DEDUCTION_FIELDS)[number]["key"];

export const MEDICLAIM_FIELDS = {
  self: fields([
    { key: "self_policy", label: "Other mediclaim policies" },
    { key: "self_checkup", label: "Preventive health check-up", hint: "max ₹5,000" },
    { key: "self_medical", label: "Medical expenses", hint: "Only if a senior citizen is covered" },
  ]),
  parents: fields([
    { key: "parents_policy", label: "Mediclaim policy for parents" },
    { key: "parents_checkup", label: "Preventive health check-up", hint: "max ₹5,000" },
    { key: "parents_medical", label: "Medical expenses", hint: "Only if a parent is a senior citizen" },
  ]),
};
export type MediclaimKey =
  | (typeof MEDICLAIM_FIELDS.self)[number]["key"]
  | (typeof MEDICLAIM_FIELDS.parents)[number]["key"];

export const FLAG_FIELDS = fields([
  { key: "metro", label: "Rented house is in a metro city", hint: "HRA limit 50% instead of 40%" },
  { key: "self_senior", label: "A family member (excluding parents) is a senior citizen" },
  { key: "parents_senior", label: "A parent is a senior citizen" },
  { key: "severe_80dd", label: "Dependant's disability is 80% or more" },
  { key: "severe_80u", label: "Own disability is 80% or more" },
  { key: "ddb_senior", label: "80DDB patient is a senior citizen" },
]);
export type FlagKey = (typeof FLAG_FIELDS)[number]["key"];

export const INCOME_FIELDS = fields([
  { key: "business", label: "Income from business & professions" },
  { key: "capital_gains", label: "Income from capital gains" },
  { key: "sb_interest", label: "Interest on savings bank deposits", hint: "Up to ₹10,000 excluded u/s 80TTA (old regime)" },
  { key: "fd_interest", label: "Interest on fixed deposits", hint: "Fully taxable (80TTB for seniors)" },
]);

export const HOUSE_TYPES = ["", "SELF", "LET_OUT"] as const;
export type HouseType = (typeof HOUSE_TYPES)[number];
export const HOUSE_TYPE_OPTIONS = [
  { value: "", label: "No house property" },
  { value: "SELF", label: "Self-occupied" },
  { value: "LET_OUT", label: "Let out" },
];

export const FORM12BB_FIELDS = fields([
  { key: "landlord_name", label: "Name of the landlord" },
  { key: "landlord_address", label: "Address of the landlord" },
  { key: "landlord_pan", label: "PAN of the landlord", hint: "Needed when rent exceeds ₹1 lakh" },
  { key: "lender_name", label: "Name of the lender" },
  { key: "lender_address", label: "Address of the lender" },
  { key: "lender_pan", label: "PAN of the lender" },
]);
export type Form12bbKey = (typeof FORM12BB_FIELDS)[number]["key"];

/** Slip figures kept per month so re-uploading a slip never double counts. */
export const SLIP_EXTRA_KEYS = [
  "recoveries",
  "professional_tax",
  "da_arrear",
  "leave_surrender",
  "festival_allowance",
  "gpais",
] as const;
export type SlipExtraKey = (typeof SLIP_EXTRA_KEYS)[number];

export type TaxData = {
  months: MonthRow[];
  /** Arrears of previous years — current-year arrears go in their month. */
  sal_arrear: SalaryRow;
  pay_revision: SalaryRow;
  other_details: Record<OtherDetailKey, number>;
  deductions: Record<DeductionKey, number>;
  sec80c_other: LineItem[];
  mediclaim: Record<MediclaimKey, number>;
  flags: Record<FlagKey, boolean>;
  house_type: HouseType;
  /** Net annual rent (rent − municipal tax), for a let-out house. */
  annual_rent: number;
  housing_interest: number;
  income: Record<(typeof INCOME_FIELDS)[number]["key"], number>;
  other_income: LineItem[];
  tds_other_bills: number;
  direct_payments: LineItem[];
  bank_tds: LineItem[];
  form12bb: Record<Form12bbKey, string>;
  lta: number;
  /** Salary months left to recover the balance from. */
  months_remaining: number;
  slip_extras: Record<SlipExtraKey, number>[];
  /** DA / HRA / NPS percentages; an empty DA schedule means "not set". */
  pay_rates: PayRateSettings;
};

/** DA % in force from salary month `from` (0 = March) until the next step. */
export type DaStep = { from: number; pct: number };
export type PayRateSettings = { da: DaStep[]; hra_pct: number; nps_pct: number };

/* ------------------------------------------------------- normalisation */

/** A non-negative whole-rupee amount from anything a form or JSON column holds. */
export const money = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

function numbers<K extends string>(keys: readonly K[], raw: unknown): Record<K, number> {
  const src = obj(raw);
  return Object.fromEntries(keys.map((k) => [k, money(src[k])])) as Record<K, number>;
}

function lineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => ({
      label: String(obj(r).label ?? "").trim().slice(0, 150),
      amount: money(obj(r).amount),
    }))
    .filter((r) => r.label || r.amount);
}

const keysOf = <K extends string>(f: readonly { key: K }[]) => f.map((x) => x.key);
const HEAD_KEYS = keysOf(SALARY_HEADS);

export const emptyRow = (): SalaryRow => numbers(HEAD_KEYS, {});

/**
 * Coerce whatever arrives (a request body, a jsonb column from an older
 * version) into a complete TaxData. Never throws; unknown keys are dropped.
 */
export function normalizeTaxData(raw: unknown): TaxData {
  const src = obj(raw);
  const months = Array.isArray(src.months) ? src.months : [];
  const extras = Array.isArray(src.slip_extras) ? src.slip_extras : [];
  const flags = obj(src.flags);
  const f12 = obj(src.form12bb);
  const remaining = Math.round(Number(src.months_remaining));
  const house = String(src.house_type ?? "");
  return {
    months: Array.from({ length: 12 }, (_, i) => {
      const m = obj(months[i]);
      const s = String(m.src ?? "");
      return {
        ...numbers(HEAD_KEYS, m),
        tds: money(m.tds),
        src: (s === "slip" || s === "projected" ? s : "") as MonthSource,
      };
    }),
    sal_arrear: numbers(HEAD_KEYS, src.sal_arrear),
    pay_revision: numbers(HEAD_KEYS, src.pay_revision),
    other_details: numbers(keysOf(OTHER_DETAIL_FIELDS), src.other_details),
    deductions: numbers(keysOf(DEDUCTION_FIELDS), src.deductions),
    sec80c_other: lineItems(src.sec80c_other),
    mediclaim: numbers([...keysOf(MEDICLAIM_FIELDS.self), ...keysOf(MEDICLAIM_FIELDS.parents)], src.mediclaim),
    flags: Object.fromEntries(keysOf(FLAG_FIELDS).map((k) => [k, flags[k] === true])) as Record<FlagKey, boolean>,
    house_type: (HOUSE_TYPES as readonly string[]).includes(house) ? (house as HouseType) : "",
    annual_rent: money(src.annual_rent),
    housing_interest: money(src.housing_interest),
    income: numbers(keysOf(INCOME_FIELDS), src.income),
    other_income: lineItems(src.other_income),
    tds_other_bills: money(src.tds_other_bills),
    direct_payments: lineItems(src.direct_payments),
    bank_tds: lineItems(src.bank_tds),
    form12bb: Object.fromEntries(
      keysOf(FORM12BB_FIELDS).map((k) => {
        const v = String(f12[k] ?? "").trim().slice(0, 255);
        return [k, k.endsWith("_pan") ? v.toUpperCase().slice(0, 10) : v];
      })
    ) as Record<Form12bbKey, string>,
    lta: money(src.lta),
    months_remaining: remaining >= 1 && remaining <= 12 ? remaining : 12,
    slip_extras: Array.from({ length: 12 }, (_, i) => numbers(SLIP_EXTRA_KEYS, extras[i])),
    pay_rates: normalizePayRates(src.pay_rates),
  };
}

export const emptyTaxData = (): TaxData => normalizeTaxData({});

/** A percentage to two decimals, 0–1000. */
export const percent = (v: unknown): number => {
  const n = Math.round(Number(v) * 100) / 100;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1000) : 0;
};

export function normalizePayRates(raw: unknown): PayRateSettings {
  const src = obj(raw);
  const steps = (Array.isArray(src.da) ? src.da : [])
    .map((s) => ({ from: Math.min(11, Math.max(0, Math.round(Number(obj(s).from)) || 0)), pct: percent(obj(s).pct) }))
    .sort((a, b) => a.from - b.from)
    // One step per month — a later entry for the same month wins.
    .filter((s, i, all) => all.findLastIndex((x) => x.from === s.from) === i);
  return { da: steps, hra_pct: percent(src.hra_pct), nps_pct: percent(src.nps_pct) };
}

/* --------------------------------------------------------- computation */

export type Line = { label: string; amount: number };

export type TaxResult = {
  regime: Regime;
  // 1. Salary
  salary_17_1: number;
  perquisites: number;
  profits_in_lieu: number;
  gross_salary: number;
  recoveries: number;
  balance_salary: number;
  hra: { received: number; rent_excess: number; limit: number; pct: number; exempt: number };
  other_exempt: number;
  total_exempt: number;
  net_salary: number;
  standard_deduction: number;
  entertainment: number;
  professional_tax: number;
  total_sec16: number;
  income_from_salary: number;
  // 2–6
  house: { type: HouseType; annual_rent: number; std30: number; interest: number; income: number };
  business: number;
  capital_gains: number;
  sb_interest: number;
  fd_interest: number;
  other_sources: number;
  gross_total_income: number;
  // 7. 80C / 80CCC / 80CCD(1)
  sec80c: Line[];
  sec80ccc: number;
  nps_total: number;
  nps_allowed: number;
  total_80cce: number;
  // 8. Other Chapter VI-A
  chapter6: Line[];
  total_chapter6: number;
  mediclaim: { medisep: number; self: number; parents: number };
  employer_nps: number;
  total_deductions: number;
  taxable_income: number;
  // Tax
  slab_tax: number;
  rebate_87a: number;
  after_rebate: number;
  surcharge: number;
  cess: number;
  total_tax: number;
  relief_89: number;
  net_tax: number;
  tax_paid: number;
  balance: number;
  monthly_tds: number;
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const sumItems = (xs: LineItem[]) => sum(xs.map((x) => x.amount));
/** Nearest multiple of ten — Sec 288A (income) and 288B (tax). */
const round10 = (n: number) => Math.round(n / 10) * 10;

/* ---------------------------------------------- deriving pay from Basic */

/** Employee NPS: 10% of basic + DA. */
const NPS_RATE = 0.1;
/** Does this month's NPS follow the 10% rule (i.e. the employee is on NPS)? */
const npsTracks = (r: SalaryRow) => r.nps > 0 && Math.abs(r.nps - Math.round((r.basic + r.da) * NPS_RATE)) <= 1;
const share = (part: number, basic: number) => Math.round((part / basic) * 10000) / 10000;

/** Shares of Basic (DA, HRA) and of Basic + DA (NPS) for one month; `nps` false = not on NPS. */
export type PayRates = { da: number; hra: number; nps: boolean; npsRate: number };

/** The DA % in force in month `i` under a schedule. */
export function daPctFor(pay: PayRateSettings, i: number): number {
  const step = [...pay.da].reverse().find((s) => s.from <= i) ?? pay.da[0];
  return step?.pct ?? 0;
}

/**
 * The rates to apply to month `i`. From the Pay rates settings when a DA
 * schedule is set; otherwise read off the month itself (else the nearest
 * earlier month with a Basic, else the nearest later one).
 */
export function payRates(rows: SalaryRow[], i: number, pay?: PayRateSettings): PayRates | null {
  if (pay && pay.da.length)
    return {
      da: daPctFor(pay, i) / 100,
      hra: pay.hra_pct / 100,
      nps: pay.nps_pct > 0,
      npsRate: pay.nps_pct / 100,
    };
  const order = [i, ...rows.map((_, k) => i - 1 - k).filter((k) => k >= 0), ...rows.map((_, k) => i + 1 + k).filter((k) => k < rows.length)];
  for (const j of order) {
    const r = rows[j];
    if (r && r.basic > 0)
      return { da: share(r.da, r.basic), hra: share(r.hra, r.basic), nps: npsTracks(r), npsRate: NPS_RATE };
  }
  return null;
}

/**
 * A new Basic with DA and HRA re-worked at the month's rates — an increment
 * in December carries its DA and HRA with it — and NPS kept at its share of
 * Basic + DA for an employee on NPS. Other heads are untouched.
 *
 * Without a rates schedule, take `rates` once, before the edit starts (when
 * the box gets focus): read from a half-typed Basic ("4" on the way to 43400)
 * they would be garbage.
 */
export function withBasic<R extends SalaryRow>(row: R, basic: number, rates: PayRates | null): R {
  if (!rates) return { ...row, basic };
  const da = Math.round(basic * rates.da);
  const hra = Math.round(basic * rates.hra);
  return { ...row, basic, da, hra, nps: rates.nps ? Math.round((basic + da) * rates.npsRate) : row.nps };
}

/** A new DA (a DA revision) — NPS follows for an employee on NPS. */
export function withDa<R extends SalaryRow>(row: R, da: number, rates: PayRates | null): R {
  return { ...row, da, nps: rates?.nps ? Math.round((row.basic + da) * rates.npsRate) : row.nps };
}

/**
 * Read the rates off the salary grid: a DA step wherever the DA % changes,
 * HRA % from the latest month, and NPS at 10% if any month follows that rule.
 */
export function detectPayRates(rows: SalaryRow[]): PayRateSettings {
  const da: DaStep[] = [];
  let last: SalaryRow | null = null;
  rows.forEach((r, i) => {
    if (r.basic <= 0) return;
    last = r;
    const pct = percent((r.da / r.basic) * 100);
    if (!da.length || da[da.length - 1].pct !== pct) da.push({ from: da.length ? i : 0, pct });
  });
  const latest = last as SalaryRow | null;
  return {
    da,
    hra_pct: latest ? percent((latest.hra / latest.basic) * 100) : 0,
    nps_pct: rows.some(npsTracks) ? NPS_RATE * 100 : 0,
  };
}

/**
 * Recalculate DA, HRA and NPS from Basic for every month that has one.
 * Months read from a salary slip keep their real figures unless `includeSlips`.
 * Returns the new months and how many changed.
 */
export function applyPayRates(months: MonthRow[], pay: PayRateSettings, includeSlips: boolean) {
  let changed = 0;
  const next = months.map((m, i) => {
    if (m.basic <= 0 || (m.src === "slip" && !includeSlips)) return m;
    const r = withBasic(m, m.basic, payRates(months, i, pay));
    if (r.da !== m.da || r.hra !== m.hra || r.nps !== m.nps) changed++;
    return r;
  });
  return { months: next, changed };
}

export const rowEarnings = (r: SalaryRow) => r.basic + r.da + r.hra + r.cca + r.other;
export const rowDeductions = (r: SalaryRow) => r.pf + r.sli + r.gis + r.lic + r.nps + r.medisep;

function slabTax(income: number, slabs: Slab[]) {
  let tax = 0;
  let from = 0;
  for (const s of slabs) {
    if (income <= from) break;
    tax += (Math.min(income, s.upto) - from) * s.rate;
    from = s.upto;
  }
  return Math.round(tax);
}

function slabsFor(rules: YearRules, regime: Regime, category: TaxCategory): Slab[] {
  if (regime === "NEW") return rules.newSlabs;
  const exempt = rules.oldExemption[category];
  return [{ upto: exempt, rate: 0 }, ...rules.oldSlabsAbove.filter((s) => s.upto > exempt)];
}

/**
 * Surcharge with marginal relief: crossing a threshold may not cost more in
 * tax + surcharge than the income that crossed it.
 */
function surchargeFor(income: number, tax: number, slabs: Slab[], bands: RegimeRules["surcharge"]) {
  let idx = -1;
  bands.forEach((b, i) => {
    if (income > b.over) idx = i;
  });
  if (idx < 0) return 0;
  const band = bands[idx];
  const prevRate = idx > 0 ? bands[idx - 1].rate : 0;
  const atThreshold = slabTax(band.over, slabs) * (1 + prevRate);
  const capped = atThreshold + (income - band.over) - tax;
  return Math.max(0, Math.round(Math.min(tax * band.rate, capped)));
}

/** Letters for the a), b), c) … lists of the printed statement. */
const letter = (i: number) => String.fromCharCode(97 + i);

export function computeTax(
  d: TaxData,
  regime: Regime,
  category: TaxCategory,
  fy: string = DEFAULT_FY
): TaxResult {
  const rules = rulesFor(fy);
  const r = rules[regime];
  const L = rules.limits;
  const dd = d.deductions;
  const od = d.other_details;
  const old = regime === "OLD";
  const senior = category !== "GENERAL";

  // ---- 1. Salary
  const rows = [...d.months, d.sal_arrear, d.pay_revision];
  const total = (k: HeadKey) => sum(rows.map((x) => x[k]));
  const salary_17_1 =
    sum(rows.map(rowEarnings)) + od.da_arrear + od.leave_surrender + od.festival_allowance;
  const gross_salary = salary_17_1 + od.perquisites + od.profits_in_lieu;
  const recoveries = Math.min(dd.recoveries, gross_salary);
  const balance_salary = gross_salary - recoveries;

  // "Salary" for HRA and the NPS cap is this year's basic + DA.
  const basicDa = sum(d.months.map((m) => m.basic + m.da));
  const pct = d.flags.metro ? 0.5 : 0.4;
  const received = total("hra");
  const rent_excess = Math.max(0, dd.rent_paid - Math.round(basicDa * 0.1));
  const limit = Math.round(basicDa * pct);
  const hraExempt = old && dd.rent_paid > 0 ? Math.min(received, rent_excess, limit) : 0;
  const other_exempt = old ? dd.exempt_allowance : 0;
  const total_exempt = Math.min(hraExempt + other_exempt, balance_salary);
  const net_salary = balance_salary - total_exempt;

  const standard_deduction = Math.min(r.standardDeduction, net_salary);
  const entertainment = old ? Math.min(dd.entertainment, L.entertainment) : 0;
  const professional_tax = old ? Math.min(dd.professional_tax, L.professionalTax) : 0;
  const total_sec16 = Math.min(standard_deduction + entertainment + professional_tax, net_salary);
  const income_from_salary = net_salary - total_sec16;

  // ---- 2. House property. The new regime sets off no loss against salary.
  const interest = d.housing_interest;
  let std30 = 0;
  let houseIncome = 0;
  if (d.house_type === "LET_OUT") {
    std30 = Math.round(d.annual_rent * 0.3);
    houseIncome = d.annual_rent - std30 - interest;
  } else if (d.house_type === "SELF") {
    houseIncome = -interest;
  }
  houseIncome = old ? Math.max(houseIncome, -L.sec24b) : Math.max(houseIncome, 0);

  // ---- 3–5. Other heads
  const { business, capital_gains, sb_interest, fd_interest } = d.income;
  const other_sources = sb_interest + fd_interest + sumItems(d.other_income);
  const gross_total_income = Math.max(
    0,
    income_from_salary + houseIncome + business + capital_gains + other_sources
  );

  // ---- 7. 80C / 80CCC / 80CCD(1) — one ₹1.5 lakh ceiling (80CCE)
  const sec80c: Line[] = old
    ? [
        ["Life Insurance Premia of self, spouse and children", total("lic") + dd.lic_other],
        ["Purchase of NSC VIII issue", dd.nsc],
        ["State Life Insurance Policy (SLI)", total("sli")],
        ["Group Insurance Scheme (GIS)", total("gis")],
        [
          "Contribution towards approved Provident Fund including PPF",
          total("pf") + od.da_arrear_pf + od.leave_surrender_pf,
        ],
        ["Tax saver Fixed Deposits in bank / Post Office ( 5 years or more)", dd.tax_saver_fd],
        ["Deposit scheme or pension fund set up by NHB", dd.nhb],
        [
          "Tuition Fees ( Paid to university, college, school or educational institution situated within India for full time education to any two children)",
          dd.tuition,
        ],
        ["Housing Loan Repayment(Principal),Stamp duty paid for purchase", dd.housing_principal],
        ["Subscription to equity shares or debentures of an eligible issue", dd.equity],
        ["Subscription to eligible units of Mutual Fund", dd.mutual_fund],
        // The printed form always carries two "any other" lines, l) and m).
        ...Array.from({ length: Math.max(2, d.sec80c_other.length) }, (_, i) => {
          const x = d.sec80c_other[i];
          return [x?.label || `Any Others Items-${i + 1}`, x?.amount ?? 0] as [string, number];
        }),
      ].map(([label, amount], i) => ({ label: `${letter(i)}) ${label}`, amount: amount as number }))
    : [];
  const sec80ccc = old ? dd.sec80ccc : 0;
  const nps_total = total("nps");
  const nps_allowed = old ? Math.min(nps_total, Math.round(basicDa * L.employeeNpsPct)) : 0;
  const claimed80cce = sum(sec80c.map((x) => x.amount)) + sec80ccc + nps_allowed;
  const total_80cce = Math.min(claimed80cce, L.sec80CCE);
  // Own NPS not deducted under 80CCD(1) may still be claimed under 80CCD(1B):
  // both the part above the 10%-of-Basic+DA cap and the part crowded out of
  // the 80CCE ceiling. Capped with the additional contribution at ₹50,000 below.
  const npsSpill = nps_total - nps_allowed + Math.min(nps_allowed, claimed80cce - total_80cce);

  // ---- 8. Other Chapter VI-A
  const m = d.mediclaim;
  const medisep = total("medisep");
  const selfSenior = senior || d.flags.self_senior;
  const checkSelf = Math.min(m.self_checkup, L.checkup);
  const checkParents = Math.min(m.parents_checkup, L.checkup - checkSelf);
  const mediSelf = Math.min(
    medisep + m.self_policy + checkSelf + (selfSenior ? m.self_medical : 0),
    selfSenior ? L.sec80D.senior : L.sec80D.normal
  );
  const mediParents = Math.min(
    m.parents_policy + checkParents + (d.flags.parents_senior ? m.parents_medical : 0),
    d.flags.parents_senior ? L.sec80D.senior : L.sec80D.normal
  );
  const employer_nps = Math.min(dd.employer_nps, Math.round(basicDa * r.employerNpsPct));

  const chapter6: Line[] = old
    ? (
        [
          ["Contribution to NPS u/s 80CCD(1B) (Max Rs.50,000)", Math.min(dd.nps_additional + npsSpill, L.sec80CCD1B)],
          [
            "Mediclaim ( Maximum of Rs.25,000 for self, spouse, dependent children and Rs.25000 for Parents. if Parents are senior citizens Rs. 50,000) U/s 80D",
            mediSelf + mediParents,
          ],
          [
            "Expenditure on Medical treatment of mentally or physically handicapped dependents (including the amount deposited in their name. ( Max. Rs. 75,000/- in case of 80% disability max. Rs.1,25,000) U/s 80DD",
            Math.min(dd.sec80dd, d.flags.severe_80dd ? L.sec80DD.severe : L.sec80DD.normal),
          ],
          [
            "Expenditure on medical treatment of the employee/dependent for specified diseases or ailment like cancer, AIDS, etc. ( Max. Rs.40,000/- in case of treatment is made to a person who is a senior citizen Rs.1,00,000) U/s 80DDB",
            Math.min(dd.sec80ddb, d.flags.ddb_senior ? L.sec80DDB.senior : L.sec80DDB.normal),
          ],
          ["Interest paid for Educational Loan for higher education U/s 80E", dd.sec80e],
          ["Donation to various charitable and other funds including PM's National Relief Fund 80-G", dd.sec80g],
          ["Deduction for interest on loan taken this year for residential house property (80EE)", Math.min(dd.sec80ee, L.sec80EE)],
          ["Interest on loan taken for purchase of Electronic Vehicles (80EEB)-Max 1.5 Lakhs", Math.min(dd.sec80eeb, L.sec80EEB)],
          [
            "Deduction for Handicapped Employees (80U)",
            Math.min(dd.sec80u, d.flags.severe_80u ? L.sec80U.severe : L.sec80U.normal),
          ],
          ["Contribution made to Political Party (80GGC)", dd.sec80ggc],
          // 80GG is only for those who receive no HRA.
          [
            "Deduct Rent Paid (If not receiving HRA and incurring Rent) (80GG)",
            received > 0 ? 0 : Math.min(dd.sec80gg, L.sec80GG),
          ],
          senior
            ? ["Deduct Interest on Deposits (Max.Rs.50000 u/s 80TTB)", Math.min(sb_interest + fd_interest, L.sec80TTB)]
            : ["Deduct Interest on SB Deposit (Max.Rs.10000 u/s 80TTA)", Math.min(sb_interest, L.sec80TTA)],
          // Not on the printed form unless claimed.
          ...(employer_nps
            ? [["Employer contribution to NPS u/s 80CCD(2)", employer_nps] as [string, number]]
            : []),
        ] as [string, number][]
      ).map(([label, amount], i) => ({ label: `${letter(i)}) ${label}`, amount }))
    : [];
  const total_chapter6 = sum(chapter6.map((x) => x.amount));

  // Chapter VI-A can never take income below zero.
  const total_deductions = Math.min(old ? total_80cce + total_chapter6 : employer_nps, gross_total_income);
  const taxable_income = round10(gross_total_income - total_deductions);

  // ---- Tax
  const slabs = slabsFor(rules, regime, category);
  const slab_tax = slabTax(taxable_income, slabs);
  let rebate_87a = 0;
  if (taxable_income <= r.rebate.upto) {
    rebate_87a = Math.min(slab_tax, r.rebate.max);
  } else if (r.rebate.marginalRelief) {
    // Just above the rebate limit, tax may not exceed the income above it.
    rebate_87a = Math.max(0, slab_tax - (taxable_income - r.rebate.upto));
  }
  const after_rebate = slab_tax - rebate_87a;
  const surcharge = surchargeFor(taxable_income, after_rebate, slabs, r.surcharge);
  const cess = Math.round((after_rebate + surcharge) * rules.cess);
  const total_tax = after_rebate + surcharge + cess;
  const relief_89 = Math.min(old ? dd.relief_89_old : dd.relief_89_new, total_tax);
  const net_tax = round10(total_tax - relief_89);

  const tax_paid =
    sum(d.months.map((x) => x.tds)) + d.tds_other_bills + sumItems(d.direct_payments) + sumItems(d.bank_tds);
  const balance = net_tax - tax_paid;
  const monthly_tds = balance > 0 ? Math.ceil(balance / d.months_remaining) : 0;

  return {
    regime,
    salary_17_1,
    perquisites: od.perquisites,
    profits_in_lieu: od.profits_in_lieu,
    gross_salary,
    recoveries,
    balance_salary,
    hra: { received, rent_excess, limit, pct, exempt: hraExempt },
    other_exempt,
    total_exempt,
    net_salary,
    standard_deduction,
    entertainment,
    professional_tax,
    total_sec16,
    income_from_salary,
    house: { type: d.house_type, annual_rent: d.annual_rent, std30, interest, income: houseIncome },
    business,
    capital_gains,
    sb_interest,
    fd_interest,
    other_sources,
    gross_total_income,
    sec80c,
    sec80ccc,
    nps_total,
    nps_allowed,
    total_80cce,
    chapter6,
    total_chapter6,
    mediclaim: { medisep, self: mediSelf, parents: mediParents },
    employer_nps,
    total_deductions,
    taxable_income,
    slab_tax,
    rebate_87a,
    after_rebate,
    surcharge,
    cess,
    total_tax,
    relief_89,
    net_tax,
    tax_paid,
    balance,
    monthly_tds,
  };
}

/** Both regimes side by side, and which one costs less. */
export function compareRegimes(input: TaxData, category: TaxCategory, fy: string = DEFAULT_FY) {
  const NEW = computeTax(input, "NEW", category, fy);
  const OLD = computeTax(input, "OLD", category, fy);
  const better: Regime = OLD.net_tax < NEW.net_tax ? "OLD" : "NEW";
  return { NEW, OLD, better, saving: Math.abs(NEW.net_tax - OLD.net_tax) };
}

/**
 * Months left to deduct from, counted from today: the salary months whose pay
 * is still to be drawn. A year already over (or not begun) spreads over all 12.
 */
export function defaultMonthsRemaining(fy: string, today = new Date()): number {
  const idx = fyMonthIndex(fy, today.getMonth() + 1, today.getFullYear());
  return idx < 0 ? 12 : Math.max(1, 12 - idx);
}

/* ------------------------------------------------------------- display */

/** "₹1,23,456" — Indian digit grouping, whole rupees. */
export const inr = (n: number) =>
  `${n < 0 ? "−" : ""}₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;

/** "1,23,456" — the bare figure printed in statement columns. */
export const num = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;

export const isValidPan = (pan: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
