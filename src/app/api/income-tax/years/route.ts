import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { incomeTaxYearT } from "@/db/schema";
import { RULES } from "@/lib/income-tax";
import { authorise, reply } from "@/lib/income-tax-api";

/**
 * Lock or unlock a financial year. Needs the "approve" right on the Income Tax
 * menu — opening a filed year for edits is a step above editing a statement.
 */
export async function PUT(req: NextRequest) {
  const session = await authorise("approve", "financial years");
  if (session instanceof NextResponse) return session;

  const body = (await req.json().catch(() => ({}))) as { financial_year?: string; locked?: unknown };
  const fy = String(body.financial_year ?? "");
  if (!RULES[fy]) return reply(400, `Tax rules for ${fy || "that year"} are not available.`);
  if (typeof body.locked !== "boolean") return reply(400, "Say whether to lock or unlock the year.");
  const locked = body.locked ? 1 : 0;

  try {
    await db
      .insert(incomeTaxYearT)
      .values({ financial_year: fy, locked, updated_by: session.id })
      .onConflictDoUpdate({
        target: incomeTaxYearT.financial_year,
        set: { locked, updated_by: session.id, updated_at: new Date() },
      });
    return reply(200, `FY ${fy} ${locked ? "locked" : "unlocked"}`);
  } catch (e) {
    console.error("income-tax years PUT", e);
    return reply(500, "The year could not be updated. Please try again.");
  }
}
