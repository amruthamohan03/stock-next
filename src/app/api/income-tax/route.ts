import { NextResponse, type NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { incomeTaxStatementT } from "@/db/schema";
import { authorise, reply } from "@/lib/income-tax-api";
import { ownedBy } from "@/lib/rbac";
import type { SessionUser } from "@/lib/session";
import { isYearLocked } from "@/lib/income-tax-queries";
import {
  RULES,
  computeTax,
  isValidPan,
  normalizeTaxData,
  toRegime,
  toTaxCategory,
} from "@/lib/income-tax";

/**
 * Anticipatory income tax statements. The client sends the raw salary and
 * deduction figures; the tax is always recomputed here so a tampered or stale
 * preview can never become the saved figure.
 */

type Body = {
  id?: number;
  financial_year?: string;
  staff_id?: string | number | null;
  employee_name?: string;
  designation?: string;
  pan?: string;
  pen?: string;
  father_name?: string;
  office?: string;
  category?: string;
  regime?: string;
  data?: unknown;
};

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max) || null;

/** Validate the body and build the row; a string is the validation error. */
function buildRow(body: Body) {
  const employee_name = str(body.employee_name, 150);
  if (!employee_name) return "Employee name is required.";

  const financial_year = String(body.financial_year ?? "");
  if (!RULES[financial_year]) return `Tax rules for ${financial_year || "that year"} are not available.`;

  const pan = str(body.pan, 10)?.toUpperCase() ?? null;
  if (pan && !isValidPan(pan)) return "PAN must look like ABCDE1234F.";

  const staffId = Number(body.staff_id);
  const category = toTaxCategory(body.category);
  const regime = toRegime(body.regime);
  const data = normalizeTaxData(body.data);
  const r = computeTax(data, regime, category, financial_year);

  return {
    financial_year,
    staff_id: Number.isInteger(staffId) && staffId > 0 ? staffId : null,
    employee_name,
    designation: str(body.designation, 150),
    pan,
    pen: str(body.pen, 20),
    father_name: str(body.father_name, 150),
    office: str(body.office, 255),
    category,
    regime,
    data,
    gross_income: String(r.gross_salary),
    taxable_income: String(r.taxable_income),
    total_tax: String(r.net_tax),
    tax_paid: String(r.tax_paid),
    balance_tax: String(r.balance),
  };
}

/** One live statement per staff member per year — a second would double-count TDS. */
async function duplicateOf(staffId: number | null, fy: string, exceptId = 0) {
  if (!staffId) return false;
  const [row] = await db
    .select({ id: incomeTaxStatementT.id })
    .from(incomeTaxStatementT)
    .where(
      and(
        eq(incomeTaxStatementT.staff_id, staffId),
        eq(incomeTaxStatementT.financial_year, fy),
        eq(incomeTaxStatementT.display, "Y"),
        ne(incomeTaxStatementT.id, exceptId)
      )
    )
    .limit(1);
  return !!row;
}

const DUPLICATE = "This employee already has a statement for that year — edit that one instead.";
const FAILED = "The statement could not be saved. Please try again.";
const lockedMsg = (fy: string) => `FY ${fy} is locked. Unlock the year to make changes.`;

/**
 * Live statement the user may touch: their own, or any for Super Admin.
 * Someone else's statement is treated as missing rather than forbidden, so
 * ids can't be probed.
 */
const reachable = (id: number, user: SessionUser) =>
  and(
    eq(incomeTaxStatementT.id, id),
    eq(incomeTaxStatementT.display, "Y"),
    ownedBy(user, incomeTaxStatementT)
  );

/** The year a reachable statement is filed under, or null when it is gone. */
async function yearOf(id: number, user: SessionUser) {
  const [row] = await db
    .select({ fy: incomeTaxStatementT.financial_year })
    .from(incomeTaxStatementT)
    .where(reachable(id, user))
    .limit(1);
  return row?.fy ?? null;
}

export async function POST(req: NextRequest) {
  const session = await authorise("add");
  if (session instanceof NextResponse) return session;

  const row = buildRow((await req.json().catch(() => ({}))) as Body);
  if (typeof row === "string") return reply(400, row);
  if (await isYearLocked(row.financial_year)) return reply(409, lockedMsg(row.financial_year));
  if (await duplicateOf(row.staff_id, row.financial_year)) return reply(409, DUPLICATE);

  try {
    const [saved] = await db
      .insert(incomeTaxStatementT)
      .values({ ...row, created_by: session.id, updated_by: session.id, display: "Y" })
      .returning({ id: incomeTaxStatementT.id });
    return reply(200, "Income tax statement saved", { data: { id: saved.id } });
  } catch (e) {
    console.error("income-tax POST", e);
    return reply(500, FAILED);
  }
}

export async function PUT(req: NextRequest) {
  const session = await authorise("edit");
  if (session instanceof NextResponse) return session;

  const body = (await req.json().catch(() => ({}))) as Body;
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return reply(400, "Statement id is required.");

  const row = buildRow(body);
  if (typeof row === "string") return reply(400, row);

  // Both ends must be open: the year it is filed under and the year it moves to.
  const current = await yearOf(id, session);
  if (!current) return reply(404, "That statement no longer exists.");
  for (const fy of new Set([current, row.financial_year]))
    if (await isYearLocked(fy)) return reply(409, lockedMsg(fy));
  if (await duplicateOf(row.staff_id, row.financial_year, id)) return reply(409, DUPLICATE);

  try {
    const updated = await db
      .update(incomeTaxStatementT)
      .set({ ...row, updated_by: session.id, updated_at: new Date() })
      .where(reachable(id, session))
      .returning({ id: incomeTaxStatementT.id });
    if (updated.length === 0) return reply(404, "That statement no longer exists.");
    return reply(200, "Income tax statement updated", { data: { id } });
  } catch (e) {
    console.error("income-tax PUT", e);
    return reply(500, FAILED);
  }
}

/** Soft delete, like every other register in the app. */
export async function DELETE(req: NextRequest) {
  const session = await authorise("delete");
  if (session instanceof NextResponse) return session;

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return reply(400, "Statement id is required.");

  const fy = await yearOf(id, session);
  if (!fy) return reply(404, "That statement no longer exists.");
  if (await isYearLocked(fy)) return reply(409, lockedMsg(fy));

  try {
    const updated = await db
      .update(incomeTaxStatementT)
      .set({ display: "N", updated_by: session.id, updated_at: new Date() })
      .where(reachable(id, session))
      .returning({ id: incomeTaxStatementT.id });
    if (updated.length === 0) return reply(404, "That statement no longer exists.");
    return reply(200, "Income tax statement deleted");
  } catch (e) {
    console.error("income-tax DELETE", e);
    return reply(500, "The statement could not be deleted. Please try again.");
  }
}
