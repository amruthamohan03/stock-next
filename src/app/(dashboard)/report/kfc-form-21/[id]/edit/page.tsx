import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { kfcForm21T, kfcForm21ItemT } from "@/db/schema";
import { getKfcItems } from "../../../kfc-form-13/items";
import { getSignatories } from "@/lib/signatories";
import KfcForm21Editor, { type Kfc21Initial } from "../../kfc21-editor";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const money = (v: unknown) => {
  const n = Number(v);
  return v === null || v === undefined || Number.isNaN(n) ? "" : String(n);
};

export default async function EditKfcForm21Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const formId = Number(id);
  if (!formId) notFound();

  const [items, signatories, headerRows] = await Promise.all([
    getKfcItems(),
    getSignatories(),
    db
      .select()
      .from(kfcForm21T)
      .where(and(eq(kfcForm21T.id, formId), eq(kfcForm21T.display, "Y")))
      .limit(1),
  ]);

  const header = headerRows[0];
  if (!header) notFound();

  const itemRows = await db
    .select()
    .from(kfcForm21ItemT)
    .where(and(eq(kfcForm21ItemT.form_id, formId), eq(kfcForm21ItemT.display, "Y")))
    .orderBy(asc(kfcForm21ItemT.sl_no));

  const initial: Kfc21Initial = {
    id: header.id,
    title: s(header.title),
    form_date: s(header.form_date),
    signed_by: s(header.signed_by),
    signatory_name: s(header.signatory_name),
    signatory_designation: s(header.signatory_designation),
    items: itemRows.map((it) => ({
      item_id: s(it.item_id),
      quantity: s(it.quantity),
      description: s(it.description),
      book_rate: money(it.book_rate),
      book_amount: money(it.book_amount),
      assessed_value: money(it.assessed_value),
      date_of_receipt: s(it.date_of_receipt),
      cause_remarks: s(it.cause_remarks),
      authority_remarks: s(it.authority_remarks),
    })),
  };

  return <KfcForm21Editor items={items} signatories={signatories} initial={initial} />;
}
