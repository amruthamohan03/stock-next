import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { stockTransactionT, stockBookT, itemMasterT } from "@/db/schema";
import StockForm, { type StockInitial } from "../../stock-form";

const iso = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
};

export default async function StockEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const txnId = Number(id);
  if (!Number.isInteger(txnId) || txnId <= 0) notFound();

  const [txn] = await db
    .select()
    .from(stockTransactionT)
    .where(and(eq(stockTransactionT.id, txnId), eq(stockTransactionT.display, "Y")))
    .limit(1);
  if (!txn) notFound();

  const stockBooks = await db
    .select({
      id: stockBookT.id,
      name: sql<string>`concat(coalesce(${itemMasterT.item_name}, 'Item ' || ${stockBookT.item_id}), ' — ', ${stockBookT.location})`,
    })
    .from(stockBookT)
    .leftJoin(itemMasterT, eq(stockBookT.item_id, itemMasterT.id))
    .where(eq(stockBookT.display, "Y"))
    .orderBy(asc(itemMasterT.item_name));

  // Reconstruct the quantity the form works with from the stored columns.
  // Receipt/Issue use a positive number; only Adjustment is signed.
  const receipt = txn.receipt_qty ?? 0;
  const issue = txn.issue_qty ?? 0;
  const type = ["RECEIPT", "ISSUE", "ADJUSTMENT"].includes(txn.transaction_type)
    ? txn.transaction_type
    : "ADJUSTMENT";
  const qty =
    type === "RECEIPT" ? receipt : type === "ISSUE" ? issue : receipt > 0 ? receipt : -issue;

  const initial: StockInitial = {
    id: txn.id,
    stock_book_id: String(txn.stock_book_id),
    transaction_type: type,
    transaction_date: iso(txn.transaction_date),
    qty: String(qty),
    voucher_no: txn.voucher_no ?? "",
    voucher_date: iso(txn.voucher_date),
    item_status: txn.item_status ?? "WORKING",
    make: txn.make ?? "",
    model: txn.model ?? "",
    serial_no: txn.serial_no ?? "",
    description: txn.description ?? "",
    remarks: txn.remarks ?? "",
  };

  return (
    <div className="space-y-6">
      <StockForm stockBooks={stockBooks} initial={initial} />
    </div>
  );
}
