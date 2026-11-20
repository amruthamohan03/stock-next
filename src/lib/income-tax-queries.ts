import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { incomeTaxStatementT, incomeTaxYearT } from "@/db/schema";
import {
  FINANCIAL_YEARS,
  lockedByDefault,
  normalizeTaxData,
  toRegime,
  toTaxCategory,
} from "@/lib/income-tax";
import { ownedBy } from "@/lib/rbac";
import type { SessionUser } from "@/lib/session";

/**
 * Server-only: one live statement, normalised into the shape the editor and
 * the statement page both take. Kept apart from `income-tax.ts`, which client
 * components import — pulling `db` in there would bundle postgres.js.
 *
 * Only statements the user created or modified are reachable unless they are
 * Super Admin; anyone else's id resolves to null, i.e. a 404.
 */
export async function getStatement(id: number, user: SessionUser) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [r] = await db
    .select()
    .from(incomeTaxStatementT)
    .where(
      and(
        eq(incomeTaxStatementT.id, id),
        eq(incomeTaxStatementT.display, "Y"),
        ownedBy(user, incomeTaxStatementT)
      )
    )
    .limit(1);
  if (!r) return null;
  return {
    id: r.id,
    financial_year: r.financial_year,
    staff_id: r.staff_id ? String(r.staff_id) : "",
    employee_name: r.employee_name,
    designation: r.designation ?? "",
    pan: r.pan ?? "",
    pen: r.pen ?? "",
    father_name: r.father_name ?? "",
    office: r.office ?? "",
    category: toTaxCategory(r.category),
    regime: toRegime(r.regime),
    data: normalizeTaxData(r.data),
  };
}

export type Statement = NonNullable<Awaited<ReturnType<typeof getStatement>>>;

export type YearStatus = { financial_year: string; locked: boolean; statements: number };

/**
 * Every year the app has rates for, with its lock state and statement count.
 * Pass the user to count only the statements they can see.
 */
export async function getYearStatus(user?: SessionUser): Promise<YearStatus[]> {
  const [locks, counts] = await Promise.all([
    db.select().from(incomeTaxYearT),
    db
      .select({
        financial_year: incomeTaxStatementT.financial_year,
        n: sql<number>`count(*)::int`,
      })
      .from(incomeTaxStatementT)
      .where(and(eq(incomeTaxStatementT.display, "Y"), user && ownedBy(user, incomeTaxStatementT)))
      .groupBy(incomeTaxStatementT.financial_year),
  ]);
  const lockOf = new Map(locks.map((l) => [l.financial_year, l.locked === 1]));
  const countOf = new Map(counts.map((c) => [c.financial_year, c.n]));
  return [...FINANCIAL_YEARS].reverse().map((fy) => ({
    financial_year: fy,
    locked: lockOf.get(fy) ?? lockedByDefault(fy),
    statements: countOf.get(fy) ?? 0,
  }));
}

/** Years open for changes, newest first. */
export async function getOpenYears(): Promise<string[]> {
  return (await getYearStatus()).filter((y) => !y.locked).map((y) => y.financial_year);
}

export async function isYearLocked(fy: string): Promise<boolean> {
  const [row] = await db
    .select({ locked: incomeTaxYearT.locked })
    .from(incomeTaxYearT)
    .where(eq(incomeTaxYearT.financial_year, fy))
    .limit(1);
  return row ? row.locked === 1 : lockedByDefault(fy);
}
