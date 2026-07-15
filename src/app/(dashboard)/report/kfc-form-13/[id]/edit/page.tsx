import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { kfcForm13T, kfcForm13ItemT } from "@/db/schema";
import { getKfcItems } from "../../items";
import { getSignatories } from "@/lib/signatories";
import KfcForm13Editor, { type KfcInitial } from "../../kfc-editor";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditKfcForm13Page({
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
      .from(kfcForm13T)
      .where(and(eq(kfcForm13T.id, formId), eq(kfcForm13T.display, "Y")))
      .limit(1),
  ]);

  const header = headerRows[0];
  if (!header) notFound();

  const itemRows = await db
    .select()
    .from(kfcForm13ItemT)
    .where(and(eq(kfcForm13ItemT.form_id, formId), eq(kfcForm13ItemT.display, "Y")))
    .orderBy(asc(kfcForm13ItemT.sl_no));

  const initial: KfcInitial = {
    id: header.id,
    title: s(header.title),
    form_date: s(header.form_date),
    signed_by: s(header.signed_by),
    signatory_name: s(header.signatory_name),
    signatory_designation: s(header.signatory_designation),
    items: itemRows.map((it) => ({
      item_id: s(it.item_id),
      article: s(it.article),
      stock_on_hand: s(it.stock_on_hand),
      purchase_year: s(it.purchase_year),
      qty_required: s(it.qty_required),
      rate_unit: s(it.rate_unit),
      supplier: s(it.supplier),
      purpose: s(it.purpose),
      delivery_place: s(it.delivery_place),
      classification_no: s(it.classification_no),
      remarks: s(it.remarks),
    })),
  };

  return <KfcForm13Editor items={items} signatories={signatories} initial={initial} />;
}
