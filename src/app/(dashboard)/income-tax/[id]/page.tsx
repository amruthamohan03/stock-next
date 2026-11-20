import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { and, asc, eq } from "drizzle-orm";
import { Lock, Pencil } from "lucide-react";
import { db } from "@/db";
import { attachmentT } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import AttachmentPanel, { type AttachmentRow } from "@/components/attachment-panel";
import { getOpenYears, getStatement } from "@/lib/income-tax-queries";
import { compareRegimes } from "@/lib/income-tax";
import { getAppSettings } from "@/lib/app-settings-queries";
import RegimeCompare from "../regime-compare";
import StatementViewer from "../statement-viewer";

/** "24-02-2026 at 10:34:22", India time — the stamp printed on the sheet. */
function printedAt(now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value])
  );
  return `${p.day}-${p.month}-${p.year} at ${p.hour}:${p.minute}:${p.second}`;
}

/** One statement: the printable sheets, the regime comparison and the slips. */
export default async function IncomeTaxStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const statementId = Number(id);
  const session = await getSession();
  if (!session) redirect(`/login?next=/income-tax/${id}`);

  const [s, fileRows, openYears, settings] = await Promise.all([
    getStatement(statementId, session),
    db
      .select({
        id: attachmentT.id,
        category: attachmentT.category,
        title: attachmentT.title,
        file_name: attachmentT.file_name,
        file_type: attachmentT.file_type,
        file_size: attachmentT.file_size,
        created_at: attachmentT.created_at,
      })
      .from(attachmentT)
      .where(
        and(
          eq(attachmentT.owner_type, "INCOME_TAX"),
          eq(attachmentT.owner_id, statementId),
          eq(attachmentT.display, "Y")
        )
      )
      .orderBy(asc(attachmentT.id)),
    getOpenYears(),
    getAppSettings(),
  ]);
  if (!s) notFound();
  const locked = !openYears.includes(s.financial_year);

  const both = compareRegimes(s.data, s.category, s.financial_year);
  const files: AttachmentRow[] = fileRows.map((f) => ({
    id: f.id,
    category: f.category ?? "OTHER",
    title: f.title,
    file_name: f.file_name,
    file_type: f.file_type,
    file_size: f.file_size,
    created_at: f.created_at ? String(f.created_at) : null,
  }));

  return (
    <div className="space-y-4">
      <StatementViewer
        header={{
          employee_name: s.employee_name,
          designation: s.designation,
          office: s.office,
          pan: s.pan,
          pen: s.pen,
          father_name: s.father_name,
          category: s.category,
          financial_year: s.financial_year,
        }}
        data={s.data}
        regime={s.regime}
        printedAt={printedAt()}
        credit={`Anticipatory Income Tax : ${settings.project_name}`}
        actions={
          locked ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-500 ring-1 ring-inset ring-amber-500/25">
              <Lock className="h-3.5 w-3.5" /> FY locked
            </span>
          ) : (
            <Link href={`/income-tax/${s.id}/edit`} className={buttonClasses({ size: "sm" })}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          )
        }
      />

      <div className="no-print grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Regime Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <RegimeCompare results={both} selected={s.regime} better={both.better} saving={both.saving} />
            {both.better !== s.regime && both.saving > 0 && (
              <p className="mt-3 rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-500 ring-1 ring-inset ring-amber-500/25">
                The other regime would cost less on these figures. Edit the statement to switch.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Salary Slips &amp; Proofs</CardTitle>
          </CardHeader>
          <CardContent>
            <AttachmentPanel ownerType="INCOME_TAX" ownerId={s.id} files={files} defaultCategory="SALARY_SLIP" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
