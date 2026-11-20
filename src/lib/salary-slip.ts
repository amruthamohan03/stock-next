import type { TextItem } from "@/lib/pdf-text";
import {
  DED_HEADS,
  EARN_HEADS,
  SLIP_EXTRA_KEYS,
  emptyRow,
  fyMonthIndex,
  salaryMonths,
  type DedKey,
  type EarnKey,
  type SalaryRow,
  type SlipExtraKey,
  type TaxData,
} from "@/lib/income-tax";

/**
 * Reading Kerala SPARK salary slips ("Salary Slip For October 2026") into the
 * statement. Parsing works on positioned text from `pdf-text.ts` and is pure,
 * and so is applying the result — the editor merges slips client-side.
 */

export type ParsedSlip = {
  month: number; // 1–12
  year: number;
  pen: string;
  name: string;
  designation: string;
  office: string;
  row: SalaryRow;
  tds: number;
  extras: Record<SlipExtraKey, number>;
  /** Slip heads that carry no tax meaning (loans, advances) — listed, not used. */
  ignored: string[];
  /** Set when the slip's own total disagrees with what was read. */
  warning?: string;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

type Target = EarnKey | DedKey | SlipExtraKey | "tds" | null;

/** Earnings heads; anything unmatched is an "other" allowance. */
const EARN_RULES: [RegExp, Target][] = [
  [/\bd\.?\s?a\.?\s*arr/i, "da_arrear"],
  [/surrender/i, "leave_surrender"],
  [/festival|bonus|ex-?gratia|incentive|onam/i, "festival_allowance"],
  [/^basic/i, "basic"],
  [/^(d\.?a\.?|dearness)\b/i, "da"],
  [/^(h\.?r\.?a\.?|house rent)\b/i, "hra"],
  [/^(c\.?c\.?a\.?|city comp)/i, "cca"],
];

/** Deduction heads; anything unmatched (loans, advances) is ignored. */
const DED_RULES: [RegExp, Target][] = [
  [/income\s*tax/i, "tds"],
  [/profession/i, "professional_tax"],
  [/excess\s*pay|dies\s*non|diesnon/i, "recoveries"],
  [/gpais/i, "gpais"],
  [/state\s*life|\bsli\b/i, "sli"],
  [/group\s*insurance|\bgis\b/i, "gis"],
  [/\bgpf\b|provident|\bpf\b/i, "pf"],
  [/\blic\b|life\s*insurance\s*corp/i, "lic"],
  [/\bnps\b|pension\s*scheme/i, "nps"],
  [/medisep/i, "medisep"],
];

const isAmount = (t: string) => /^\d+(\.\d+)?$/.test(t.replace(/,/g, ""));

/**
 * "Basic Pay 42300" → [{label, amount}]. A number closes a pair only when the
 * next token is not also a number, so an account number printed before the
 * amount ("NPS … 110253768764 5795") stays in the label.
 */
export function labelAmounts(tokens: string[]) {
  const out: { label: string; amount: number }[] = [];
  let buf: string[] = [];
  tokens.forEach((t, i) => {
    if (isAmount(t) && !(i + 1 < tokens.length && isAmount(tokens[i + 1])) && buf.length) {
      out.push({ label: buf.join(" "), amount: Math.round(Number(t.replace(/,/g, ""))) });
      buf = [];
    } else buf.push(t);
  });
  return out;
}

/** Text of a run of items, with a space only where the runs are apart. */
function joinItems(items: TextItem[]) {
  let s = "";
  items.forEach((it, i) => {
    if (i > 0) {
      const prev = items[i - 1];
      const gap = it.x - (prev.x + prev.str.length * prev.size * 0.45);
      s += gap > prev.size * 0.15 || /\s$/.test(prev.str) ? " " : "";
    }
    s += it.str;
  });
  return s.replace(/\s+/g, " ").trim();
}

const classify = (label: string, rules: [RegExp, Target][]) =>
  rules.find(([re]) => re.test(label))?.[1] ?? null;

export function parseSlip(lines: TextItem[][]): ParsedSlip | string {
  const texts = lines.map(joinItems);
  const all = texts.join("\n");

  const period = /Salary\s*Slip\s*For\s+([A-Za-z]+)\s*,?\s*(\d{4})/i.exec(all);
  const month = period ? MONTHS.indexOf(period[1].slice(0, 3).toLowerCase()) + 1 : 0;
  if (!period || month === 0) return "No \"Salary Slip For <month> <year>\" heading — is this a SPARK salary slip?";

  // Column split: the "Deductions" heading's left edge.
  const headIdx = lines.findIndex((l) => l.some((i) => /^\s*Earnings\b/i.test(i.str)));
  if (headIdx < 0) return "Could not find the Earnings / Deductions table on the slip.";
  const dedHead = lines[headIdx].find((i) => /Deductions/i.test(i.str));
  const split = dedHead
    ? dedHead.x + (dedHead.str.search(/Deductions/i) > 0 ? dedHead.size * 0.45 * dedHead.str.search(/Deductions/i) : 0) - 2
    : null;

  const row = emptyRow();
  const extras = Object.fromEntries(SLIP_EXTRA_KEYS.map((k) => [k, 0])) as Record<SlipExtraKey, number>;
  const ignored: string[] = [];
  let tds = 0;
  let slipEarnTotal: number | null = null;
  let earnRead = 0;

  const put = (target: Target, amount: number, label: string) => {
    if (target === null) ignored.push(`${label} ${amount}`);
    else if (target === "tds") tds += amount;
    else if (target in row) row[target as EarnKey | DedKey] += amount;
    else extras[target as SlipExtraKey] += amount;
  };

  for (let li = headIdx + 1; li < lines.length; li++) {
    const line = lines[li];
    const text = texts[li];
    if (/^Total\b/i.test(text)) {
      // The first figure on the Total line is the earnings total.
      const first = /\d+/.exec(text);
      slipEarnTotal = first ? Number(first[0]) : null;
      break;
    }
    if (/^Net\s*Pay/i.test(text)) break;

    const left = split === null ? line : line.filter((i) => i.x < split);
    const right = split === null ? [] : line.filter((i) => i.x >= split);
    const pairs = (items: TextItem[]) => labelAmounts(joinItems(items).split(" "));

    if (split === null) {
      // No column edge: the first pair on a line is an earning, the rest deductions.
      pairs(left).forEach((p, k) => {
        const target = k === 0 ? classify(p.label, EARN_RULES) ?? "other" : classify(p.label, DED_RULES);
        if (k === 0) earnRead += p.amount;
        put(target, p.amount, p.label);
      });
      continue;
    }
    for (const p of pairs(left)) {
      earnRead += p.amount;
      put(classify(p.label, EARN_RULES) ?? "other", p.amount, p.label);
    }
    for (const p of pairs(right)) put(classify(p.label, DED_RULES), p.amount, p.label);
  }

  if (row.basic === 0) return "Could not read Basic Pay from the slip.";

  const pick = (re: RegExp) => {
    for (const t of texts) {
      const m = re.exec(t);
      if (m) return m[1].trim();
    }
    return "";
  };
  // A field that wraps onto the next line continues there (no "label :" on it).
  const withWrap = (re: RegExp, stop: RegExp) => {
    const i = texts.findIndex((t) => re.test(t));
    if (i < 0) return "";
    let v = re.exec(texts[i])![1].replace(stop, "").trim();
    const next = lines[i + 1];
    if (next && split !== null) {
      const cont = joinItems(next.filter((it) => it.x < split));
      if (cont && !cont.includes(":") && !/^Earnings/i.test(cont)) v += ` ${cont}`;
    }
    return v.trim();
  };

  return {
    month,
    year: Number(period[2]),
    pen: pick(/Permanent\s*Employee\s*No\.?\s*:?\s*(\d+)/i),
    name: pick(/(?<!Bill\s)Name\s*:\s*([A-Za-z][A-Za-z .']*?)(?=\s+(?:Designation|Scale|Bill|Place)\b|$)/i),
    designation: withWrap(/Designation\s*:\s*(.+)$/i, /\s*Scale of Pay.*$/i),
    office: withWrap(/Place\s*of\s*Posting\s*:\s*(.+)$/i, /\s*Bill Name.*$/i).replace(/,\s*$/, ""),
    row,
    tds,
    extras,
    ignored,
    warning:
      slipEarnTotal !== null && slipEarnTotal !== earnRead
        ? `Earnings read (${earnRead}) differ from the slip total (${slipEarnTotal}) — check the month.`
        : undefined,
  };
}

/* ------------------------------------------------------- applying slips */

export type SlipSummary = {
  filled: string[];
  projected: string[];
  /** Slips for a different financial year — not applied. */
  otherYear: string[];
  data: TaxData;
};

const HEADS = [...EARN_HEADS, ...DED_HEADS].map((h) => h.key);
const isBlank = (r: SalaryRow) => HEADS.every((k) => r[k] === 0);

/**
 * Merge parsed slips into a statement for `fy`:
 * - each slip's month takes the slip's figures and its income tax as TDS;
 * - months with no slip that are empty (or were projected before) are
 *   projected from the nearest slip — the anticipated rest of the year;
 * - arrears, surrender, festival allowance, recoveries, professional tax and
 *   GPAIS are kept per month in `slip_extras`, and the statement's fields are
 *   set from their totals, so uploading a slip twice never double counts.
 */
export function applySlips(data: TaxData, fy: string, slips: ParsedSlip[]): SlipSummary {
  const labels = salaryMonths(fy);
  const months = data.months.map((m) => ({ ...m }));
  const slip_extras = data.slip_extras.map((x) => ({ ...x }));
  const filled: string[] = [];
  const otherYear: string[] = [];

  for (const s of slips) {
    const idx = fyMonthIndex(fy, s.month, s.year);
    if (idx < 0) {
      otherYear.push(`${MONTHS[s.month - 1].replace(/^./, (c) => c.toUpperCase())} ${s.year}`);
      continue;
    }
    months[idx] = { ...s.row, tds: s.tds, src: "slip" };
    slip_extras[idx] = { ...s.extras };
    filled.push(labels[idx]);
  }

  // Every month without a slip — still blank, or projected earlier — is
  // projected from the nearest earlier slip (the nearest later one for months
  // before the first slip). Months typed in by hand are left alone.
  const projected: string[] = [];
  const slipIdx = months.flatMap((m, i) => (m.src === "slip" ? [i] : []));
  const last = slipIdx.length ? slipIdx[slipIdx.length - 1] : -1;
  for (let i = 0; i < 12 && slipIdx.length; i++) {
    if (months[i].src === "slip" || (months[i].src !== "projected" && !isBlank(months[i]))) continue;
    const from = [...slipIdx].reverse().find((j) => j < i) ?? slipIdx[0];
    months[i] = { ...months[from], tds: 0, src: "projected" };
    projected.push(labels[i]);
  }

  const total = (k: SlipExtraKey) => slip_extras.reduce((a, x) => a + x[k], 0);
  const maxOne = (k: SlipExtraKey) => Math.max(...slip_extras.map((x) => x[k]));
  const next: TaxData = {
    ...data,
    months,
    slip_extras,
    other_details: { ...data.other_details },
    deductions: { ...data.deductions },
    sec80c_other: [...data.sec80c_other],
  };
  if (total("da_arrear")) next.other_details.da_arrear = total("da_arrear");
  if (total("leave_surrender")) next.other_details.leave_surrender = total("leave_surrender");
  if (total("festival_allowance")) next.other_details.festival_allowance = total("festival_allowance");
  if (total("recoveries")) next.deductions.recoveries = total("recoveries");
  // Kerala collects professional tax half-yearly — one instalment implies two.
  if (total("professional_tax"))
    next.deductions.professional_tax = Math.min(2500, Math.max(total("professional_tax"), maxOne("professional_tax") * 2));
  if (total("gpais")) {
    const i = next.sec80c_other.findIndex((x) => /gpais/i.test(x.label));
    const item = { label: "GPAIS", amount: total("gpais") };
    if (i >= 0) next.sec80c_other[i] = item;
    else next.sec80c_other.push(item);
  }
  if (last >= 0) next.months_remaining = Math.max(1, 11 - last);

  return { filled, projected, otherYear, data: next };
}
