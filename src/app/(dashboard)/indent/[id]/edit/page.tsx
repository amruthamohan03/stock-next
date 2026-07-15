import { notFound } from "next/navigation";
import { asc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { indentMasterT, indentItemT } from "@/db/schema";
import IndentForm, { type IndentInitial } from "../../indent-form";
import { getIndentOptions } from "../../options";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function IndentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const indentId = Number(id);
  if (!indentId) notFound();

  const [{ groups, items, makes, models }, headerRows] = await Promise.all([
    getIndentOptions(),
    db
      .select()
      .from(indentMasterT)
      .where(and(eq(indentMasterT.id, indentId), eq(indentMasterT.display, "Y")))
      .limit(1),
  ]);

  const header = headerRows[0];
  if (!header) notFound();

  const itemRows = await db
    .select()
    .from(indentItemT)
    .where(and(eq(indentItemT.indent_id, indentId), eq(indentItemT.display, "Y")))
    .orderBy(asc(indentItemT.sl_no));

  const initial: IndentInitial = {
    id: header.id,
    book_no: s(header.book_no),
    indent_no: s(header.indent_no),
    item_type: header.item_type ?? "N",
    indent_date: s(header.indent_date),
    purpose: s(header.purpose),
    items: itemRows.map((it) => ({
      group_id: s(it.group_id),
      item_id: s(it.item_id),
      make_id: s(it.make_id),
      model_id: s(it.model_id),
      description: s(it.item_description),
      purpose: s(it.item_purpose),
      qty: s(it.qty_intended),
      remarks: s(it.remarks),
      sb_page: s(it.stock_book_page_no),
      sb_vol: s(it.stock_book_volume),
      db_page: s(it.day_book_page_no),
      db_vol: s(it.day_book_volume),
    })),
  };

  return (
    <div className="space-y-6">
      <IndentForm
        groups={groups}
        items={items}
        makes={makes}
        models={models}
        initial={initial}
      />
    </div>
  );
}
