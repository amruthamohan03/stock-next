import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { daybookMasterT, daybookItemT } from "@/db/schema";
import { getDaybookOptions } from "../../options";
import DaybookForm, { type DaybookInitial, type LineRow } from "../../daybook-form";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
/** numeric columns come back as strings like "12.00" — show a clean number. */
const dec = (v: unknown) => {
  const n = Number(v);
  return v === null || v === undefined || Number.isNaN(n) || n === 0 ? "" : String(n);
};
const iso = (v: unknown) => (v ? String(v).slice(0, 10) : "");

export default async function DaybookEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dbId = Number(id);
  if (!Number.isInteger(dbId) || dbId <= 0) notFound();

  const [options, headerRows] = await Promise.all([
    getDaybookOptions(),
    db
      .select()
      .from(daybookMasterT)
      .where(and(eq(daybookMasterT.id, dbId), eq(daybookMasterT.display, "Y")))
      .limit(1),
  ]);

  const m = headerRows[0];
  if (!m) notFound();

  const lines = await db
    .select()
    .from(daybookItemT)
    .where(and(eq(daybookItemT.daybook_id, dbId), eq(daybookItemT.display, "Y")))
    .orderBy(asc(daybookItemT.sl_no));

  const toRow = (l: (typeof lines)[number]): LineRow => ({
    item_id: s(l.item_id),
    item_description: s(l.item_description),
    unit_id: s(l.unit_id),
    receipt_qty_number: dec(l.receipt_qty_number),
    receipt_qty_weight: dec(l.receipt_qty_weight),
    receipt_rate: dec(l.receipt_rate),
    receipt_amount_rs: dec(l.receipt_amount_rs),
    receipt_amount_ps: dec(l.receipt_amount_ps),
    issue_qty_number: dec(l.issue_qty_number),
    issue_qty_weight: dec(l.issue_qty_weight),
    issue_rate: dec(l.issue_rate),
    issue_amount_rs: dec(l.issue_amount_rs),
    issue_amount_ps: dec(l.issue_amount_ps),
    balance_rate: dec(l.balance_rate),
    balance_amount_ps: dec(l.balance_amount_ps),
    indent_no: s(l.indent_no),
    indent_date: iso(l.indent_date),
    issued_to_id: s(l.issued_to_id),
  });

  const initial: DaybookInitial = {
    id: m.id,
    page_no: s(m.page_no),
    stockbook_type_id: s(m.stockbook_type_id),
    class: s(m.class),
    unit_label: s(m.unit_label),
    receipt_order_no: s(m.receipt_order_no),
    document_date: iso(m.document_date),
    service_provider_id: s(m.service_provider_id),
    invoice_ref: s(m.invoice_ref),
    invoice_date: iso(m.invoice_date),
    issued_to_id: s(m.issued_to_id),
    cr_voucher_ref: s(m.cr_voucher_ref),
    verifier_id: s(m.verifier_id),
    remarks: s(m.remarks),
    receipt_items: lines.filter((l) => l.transaction_type === "RECEIPT").map(toRow),
    issue_items: lines.filter((l) => l.transaction_type === "ISSUE").map(toRow),
  };

  return <DaybookForm {...options} initial={initial} />;
}
