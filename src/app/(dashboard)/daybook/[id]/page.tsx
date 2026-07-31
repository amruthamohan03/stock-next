import Link from "next/link";
import { notFound } from "next/navigation";
import { aliasedTable, and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  daybookMasterT,
  daybookItemT,
  stockbookTypeT,
  serviceProvidersT,
  issuedToMasterT,
  usersT,
  itemMasterT,
  daybookUnitT,
} from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import PrintButton from "../../report/_components/print-button";

const num = (v: unknown) => Number(v ?? 0);
const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Ports DaybookController::viewDayBook — the printable K.F.C. Form 16 detail.
export default async function DaybookViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dbId = Number(id);
  if (!Number.isInteger(dbId) || dbId <= 0) notFound();

  const verifier = aliasedTable(usersT, "verifier");
  const creator = aliasedTable(usersT, "creator");
  const lineIssuedTo = aliasedTable(issuedToMasterT, "line_issued_to");

  const [master] = await db
    .select({
      id: daybookMasterT.id,
      page_no: daybookMasterT.page_no,
      class: daybookMasterT.class,
      unit_label: daybookMasterT.unit_label,
      document_date: daybookMasterT.document_date,
      receipt_order_no: daybookMasterT.receipt_order_no,
      invoice_ref: daybookMasterT.invoice_ref,
      invoice_date: daybookMasterT.invoice_date,
      cr_voucher_ref: daybookMasterT.cr_voucher_ref,
      remarks: daybookMasterT.remarks,
      status: daybookMasterT.status,
      created_at: daybookMasterT.created_at,
      updated_at: daybookMasterT.updated_at,
      stockbook_name: stockbookTypeT.name,
      provider_name: serviceProvidersT.provider_name,
      issued_to_name: issuedToMasterT.location_name,
      verifier_name: verifier.full_name,
      created_by_name: creator.full_name,
    })
    .from(daybookMasterT)
    .leftJoin(stockbookTypeT, eq(stockbookTypeT.id, daybookMasterT.stockbook_type_id))
    .leftJoin(serviceProvidersT, eq(serviceProvidersT.id, daybookMasterT.service_provider_id))
    .leftJoin(issuedToMasterT, eq(issuedToMasterT.id, daybookMasterT.issued_to_id))
    .leftJoin(verifier, eq(verifier.id, daybookMasterT.verifier_id))
    .leftJoin(creator, eq(creator.id, daybookMasterT.created_by))
    .where(and(eq(daybookMasterT.id, dbId), eq(daybookMasterT.display, "Y")))
    .limit(1);

  if (!master) notFound();

  const lines = await db
    .select({
      id: daybookItemT.id,
      sl_no: daybookItemT.sl_no,
      transaction_type: daybookItemT.transaction_type,
      item_name: itemMasterT.item_name,
      item_description: daybookItemT.item_description,
      unit_name: daybookUnitT.name,
      receipt_qty_number: daybookItemT.receipt_qty_number,
      receipt_qty_weight: daybookItemT.receipt_qty_weight,
      issue_qty_number: daybookItemT.issue_qty_number,
      issue_qty_weight: daybookItemT.issue_qty_weight,
      receipt_rate: daybookItemT.receipt_rate,
      receipt_amount_rs: daybookItemT.receipt_amount_rs,
      receipt_amount_ps: daybookItemT.receipt_amount_ps,
      issue_rate: daybookItemT.issue_rate,
      issue_amount_rs: daybookItemT.issue_amount_rs,
      issue_amount_ps: daybookItemT.issue_amount_ps,
      balance_rate: daybookItemT.balance_rate,
      balance_amount_rs: daybookItemT.balance_amount_rs,
      balance_amount_ps: daybookItemT.balance_amount_ps,
      value_verifier: daybookItemT.value_verifier,
      indent_no: daybookItemT.indent_no,
      indent_date: daybookItemT.indent_date,
      issued_to_name: lineIssuedTo.location_name,
    })
    .from(daybookItemT)
    .leftJoin(itemMasterT, eq(itemMasterT.id, daybookItemT.item_id))
    .leftJoin(daybookUnitT, eq(daybookUnitT.id, daybookItemT.unit_id))
    .leftJoin(lineIssuedTo, eq(lineIssuedTo.id, daybookItemT.issued_to_id))
    .where(and(eq(daybookItemT.daybook_id, dbId), eq(daybookItemT.display, "Y")))
    .orderBy(asc(daybookItemT.sl_no));

  const receipts = lines.filter((l) => l.transaction_type === "RECEIPT");
  const issues = lines.filter((l) => l.transaction_type === "ISSUE");

  const rTot = receipts.reduce(
    (a, r) => ({
      qn: a.qn + num(r.receipt_qty_number),
      qw: a.qw + num(r.receipt_qty_weight),
      amt: a.amt + num(r.receipt_amount_rs),
    }),
    { qn: 0, qw: 0, amt: 0 }
  );
  const iTot = issues.reduce(
    (a, r) => ({
      qn: a.qn + num(r.issue_qty_number),
      qw: a.qw + num(r.issue_qty_weight),
      amt: a.amt + num(r.issue_amount_rs),
    }),
    { qn: 0, qw: 0, amt: 0 }
  );

  const info = (label: string, value: React.ReactNode) => (
    <div className="flex gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-muted">{label}</span>
      <span className="text-fg">: {value || "—"}</span>
    </div>
  );

  const dash = (n: number) => (n !== 0 ? n : "—");

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-fg">
          Day Book — <span className="text-accent">{master.provider_name ?? ""}</span>{" "}
          <span className="text-muted">{formatDate(master.document_date)}</span>
        </h1>
        <div className="flex gap-2">
          <Link href="/daybook" className={buttonClasses({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <Link href={`/daybook/${master.id}/edit`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <PrintButton />
        </div>
      </div>

      <Card className="p-5">
        <div className="printable">
          {/* K.F.C. Form 16 header */}
          <div className="mb-4 text-center">
            <div className="text-[11px] uppercase tracking-widest text-muted">K.F.C. Form 16</div>
            <div className="text-[10px] text-faint">[See Chapter VII, Article 161 (a)]</div>
            <h2 className="mt-1 text-base font-bold text-fg">DAY BOOK OF STORES</h2>
          </div>

          {/* Master info */}
          <div className="mb-4 grid grid-cols-1 gap-x-6 gap-y-1 border-b border-line pb-4 md:grid-cols-2">
            {info("Stockbook", master.stockbook_name)}
            {info("Issued To", master.issued_to_name)}
            {info("Page No", master.page_no)}
            {info("Order / Ref No", master.receipt_order_no)}
            {info("Class / Unit", `${master.class || "-"} / ${master.unit_label || "-"}`)}
            {info("Invoice Ref", master.invoice_ref)}
            {info("Document Date", formatDate(master.document_date))}
            {info("Invoice Date", master.invoice_date ? formatDate(master.invoice_date) : null)}
            {info("By Whom / Provider", master.provider_name)}
            {info("CR Voucher Ref", master.cr_voucher_ref)}
            {info("Verifier", master.verifier_name)}
            {info("Remarks", master.remarks)}
          </div>

          {/* Receipts */}
          <Section title="RECEIPTS" tone="emerald" count={receipts.length}>
            {receipts.length === 0 ? (
              <Empty label="No receipt items recorded." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-xs" style={{ minWidth: "62rem" }}>
                  <TableHead
                    cols={["Sl", "Item Name", "Description", "Unit"]}
                    groups={[
                      { label: "Receipt Qty", sub: ["No.", "Wt/Msr"] },
                      { label: "Receipt Value", sub: ["Rate", "Rs.", "Ps."] },
                      { label: "Balance", sub: ["Rate", "Rs.", "Ps."] },
                    ]}
                    tail={["Verifier"]}
                  />
                  <tbody>
                    {receipts.map((r) => (
                      <tr key={r.id} className="border-b border-line/60">
                        <td className="px-2 py-2 text-center text-faint">{r.sl_no}</td>
                        <td className="px-2 py-2 font-medium text-fg">{r.item_name || "—"}</td>
                        <td className="px-2 py-2 text-faint">{r.item_description || "—"}</td>
                        <td className="px-2 py-2 text-center">{r.unit_name || "—"}</td>
                        <td className="px-2 py-2 text-right">{dash(num(r.receipt_qty_number))}</td>
                        <td className="px-2 py-2 text-right">{dash(num(r.receipt_qty_weight))}</td>
                        <td className="px-2 py-2 text-right">{inr(num(r.receipt_rate))}</td>
                        <td className="px-2 py-2 text-right font-semibold text-emerald-600">{inr(num(r.receipt_amount_rs))}</td>
                        <td className="px-2 py-2 text-right">{dash(num(r.receipt_amount_ps))}</td>
                        <td className="px-2 py-2 text-right">{inr(num(r.balance_rate))}</td>
                        <td className="px-2 py-2 text-right font-semibold">{inr(num(r.balance_amount_rs))}</td>
                        <td className="px-2 py-2 text-right">{dash(num(r.balance_amount_ps))}</td>
                        <td className="px-2 py-2 text-center">{r.value_verifier || ""}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-500/10 font-bold text-fg">
                      <td colSpan={4} className="px-2 py-2 text-right">RECEIPT TOTAL</td>
                      <td className="px-2 py-2 text-right">{rTot.qn}</td>
                      <td className="px-2 py-2 text-right">{rTot.qw}</td>
                      <td colSpan={2} className="px-2 py-2 text-right">{inr(rTot.amt)}</td>
                      <td colSpan={5} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Issues */}
          <Section title="ISSUES" tone="rose" count={issues.length}>
            {issues.length === 0 ? (
              <Empty label="No issue items recorded." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-xs" style={{ minWidth: "68rem" }}>
                  <TableHead
                    cols={["Sl", "Item Name", "Description", "Unit"]}
                    groups={[
                      { label: "Issue Qty", sub: ["No.", "Wt/Msr"] },
                      { label: "Issue Value", sub: ["Rate", "Rs."] },
                      { label: "Balance", sub: ["Rate", "Rs.", "Ps."] },
                    ]}
                    tail={["Indent No", "Indent Date", "Issued To"]}
                  />
                  <tbody>
                    {issues.map((r) => (
                      <tr key={r.id} className="border-b border-line/60">
                        <td className="px-2 py-2 text-center text-faint">{r.sl_no}</td>
                        <td className="px-2 py-2 font-medium text-fg">{r.item_name || "—"}</td>
                        <td className="px-2 py-2 text-faint">{r.item_description || "—"}</td>
                        <td className="px-2 py-2 text-center">{r.unit_name || "—"}</td>
                        <td className="px-2 py-2 text-right">{dash(num(r.issue_qty_number))}</td>
                        <td className="px-2 py-2 text-right">{dash(num(r.issue_qty_weight))}</td>
                        <td className="px-2 py-2 text-right">{inr(num(r.issue_rate))}</td>
                        <td className="px-2 py-2 text-right font-semibold text-rose-600">{inr(num(r.issue_amount_rs))}</td>
                        <td className="px-2 py-2 text-right">{inr(num(r.balance_rate))}</td>
                        <td className="px-2 py-2 text-right font-semibold">{inr(num(r.balance_amount_rs))}</td>
                        <td className="px-2 py-2 text-right">{dash(num(r.balance_amount_ps))}</td>
                        <td className="px-2 py-2">{r.indent_no || "—"}</td>
                        <td className="px-2 py-2">{r.indent_date ? formatDate(r.indent_date) : "—"}</td>
                        <td className="px-2 py-2 text-center">{r.issued_to_name || ""}</td>
                      </tr>
                    ))}
                    <tr className="bg-rose-500/10 font-bold text-fg">
                      <td colSpan={4} className="px-2 py-2 text-right">ISSUE TOTAL</td>
                      <td className="px-2 py-2 text-right">{iTot.qn}</td>
                      <td className="px-2 py-2 text-right">{iTot.qw}</td>
                      <td />
                      <td className="px-2 py-2 text-right">{inr(iTot.amt)}</td>
                      <td colSpan={6} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Net summary */}
          <div className="mt-4 flex justify-end">
            <table className="w-full max-w-xs text-sm">
              <tbody>
                <tr className="bg-emerald-500/10">
                  <td className="border border-line px-3 py-1.5 font-semibold">Total Receipts (Rs.)</td>
                  <td className="border border-line px-3 py-1.5 text-right font-bold">{inr(rTot.amt)}</td>
                </tr>
                <tr className="bg-rose-500/10">
                  <td className="border border-line px-3 py-1.5 font-semibold">Total Issues (Rs.)</td>
                  <td className="border border-line px-3 py-1.5 text-right font-bold">{inr(iTot.amt)}</td>
                </tr>
                <tr className="bg-amber-500/10">
                  <td className="border border-line px-3 py-1.5 font-semibold">Net Balance (Rs.)</td>
                  <td className="border border-line px-3 py-1.5 text-right font-bold">{inr(rTot.amt - iTot.amt)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-line pt-2 text-xs text-faint">
            <div>
              <span
                className={`mr-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  master.status === "ACTIVE"
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-slate-500/15 text-muted"
                }`}
              >
                {master.status}
              </span>
              Created: {formatDateTime(master.created_at)} by{" "}
              <span className="font-medium text-muted">{master.created_by_name ?? "N/A"}</span>
            </div>
            <div>Last Updated: {formatDateTime(master.updated_at)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Section({
  title,
  tone,
  count,
  children,
}: {
  title: string;
  tone: "emerald" | "rose";
  count: number;
  children: React.ReactNode;
}) {
  const color = tone === "emerald" ? "text-emerald-600" : "text-rose-600";
  const badge = tone === "emerald" ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500";
  return (
    <div className="mb-5">
      <h3 className={`mb-2 text-sm font-bold ${color}`}>
        {title}
        <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge}`}>
          {count} line(s)
        </span>
      </h3>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-faint">
      {label}
    </div>
  );
}

/** Two-row header: plain columns, grouped qty/value columns, then tail columns. */
function TableHead({
  cols,
  groups,
  tail,
}: {
  cols: string[];
  groups: { label: string; sub: string[] }[];
  tail: string[];
}) {
  return (
    <thead>
      <tr className="border-b border-line bg-elevated text-left text-[11px] uppercase tracking-wider text-muted">
        {cols.map((c) => (
          <th key={c} rowSpan={2} className="px-2 py-2 font-semibold">
            {c}
          </th>
        ))}
        {groups.map((g) => (
          <th key={g.label} colSpan={g.sub.length} className="px-2 py-2 text-center font-semibold">
            {g.label}
          </th>
        ))}
        {tail.map((c) => (
          <th key={c} rowSpan={2} className="px-2 py-2 font-semibold">
            {c}
          </th>
        ))}
      </tr>
      <tr className="border-b border-line bg-elevated/60 text-left text-[10px] text-faint">
        {groups.flatMap((g) =>
          g.sub.map((s) => (
            <th key={`${g.label}-${s}`} className="px-2 py-1 font-normal">
              {s}
            </th>
          ))
        )}
      </tr>
    </thead>
  );
}
