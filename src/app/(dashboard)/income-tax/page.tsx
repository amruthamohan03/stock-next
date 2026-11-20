import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { incomeTaxStatementT } from "@/db/schema";
import { buttonClasses } from "@/components/ui/button";
import { StatCards } from "@/components/stat-cards";
import { inr } from "@/lib/income-tax";
import { getYearStatus } from "@/lib/income-tax-queries";
import { INCOME_TAX_MENU } from "@/lib/income-tax-api";
import { getSession } from "@/lib/session";
import { hasPermission, ownedBy } from "@/lib/rbac";
import StatementList from "./statement-list";
import YearLocks from "./year-locks";

/** Anticipatory income tax statements — one per employee per year. */
export default async function IncomeTaxPage() {
  // Read first: the list is scoped to the user's own statements (all for Super Admin).
  const session = await getSession();
  if (!session) redirect("/login?next=/income-tax");

  const [raw, years, canManage] = await Promise.all([
    db
    .select({
      id: incomeTaxStatementT.id,
      financial_year: incomeTaxStatementT.financial_year,
      employee_name: incomeTaxStatementT.employee_name,
      designation: incomeTaxStatementT.designation,
      pan: incomeTaxStatementT.pan,
      regime: incomeTaxStatementT.regime,
      gross_income: incomeTaxStatementT.gross_income,
      taxable_income: incomeTaxStatementT.taxable_income,
      total_tax: incomeTaxStatementT.total_tax,
      balance_tax: incomeTaxStatementT.balance_tax,
    })
    .from(incomeTaxStatementT)
    .where(and(eq(incomeTaxStatementT.display, "Y"), ownedBy(session, incomeTaxStatementT)))
    .orderBy(desc(incomeTaxStatementT.financial_year), incomeTaxStatementT.employee_name),
    getYearStatus(session),
    hasPermission(session.roleId, INCOME_TAX_MENU, "approve"),
  ]);
  const locked = years.filter((y) => y.locked).map((y) => y.financial_year);
  const anyOpen = locked.length < years.length;

  // numeric columns arrive as strings; convert once here, not in every render.
  const rows = raw.map((r) => ({
    ...r,
    gross_income: Number(r.gross_income ?? 0),
    taxable_income: Number(r.taxable_income ?? 0),
    total_tax: Number(r.total_tax ?? 0),
    balance_tax: Number(r.balance_tax ?? 0),
  }));

  let tax = 0;
  let balance = 0;
  for (const r of rows) {
    tax += r.total_tax;
    balance += Math.max(0, r.balance_tax);
  }

  return (
    <div className="space-y-4">
      <StatCards
        stats={[
          { label: "Statements", value: rows.length },
          { label: "Total tax", value: inr(tax), tone: "primary" },
          { label: "Balance to deduct", value: inr(balance), tone: "warning" },
          {
            label: "Old regime",
            value: rows.filter((r) => r.regime === "OLD").length,
            tone: "success",
          },
        ]}
      />
      <YearLocks years={years} canManage={canManage} />
      <StatementList
        rows={rows}
        locked={locked}
        actions={
          anyOpen && (
            <Link href="/income-tax/new" className={buttonClasses({ size: "sm" })}>
              <Plus className="h-4 w-4" /> New
            </Link>
          )
        }
      />
    </div>
  );
}
