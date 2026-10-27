import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { stockTransactionT } from "@/db/schema";
import StockForm, { type StockInitial } from "../../stock-form";
import { getStockOptions } from "../../options";

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

  const { stockBooks, departments, registers, locations, indentBooks, indents } =
    await getStockOptions();

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
    stock_book_id: `book:${txn.stock_book_id}`,
    stock_book_master_id: txn.stock_book_master_id ? String(txn.stock_book_master_id) : "",
    stock_book_page_no: txn.stock_book_page_no ? String(txn.stock_book_page_no) : "",
    issued_to_location_id: txn.issued_to_location_id ? String(txn.issued_to_location_id) : "",
    no_indent_entry: txn.no_indent_entry === "Y" ? "Y" : "N",
    indent_id: txn.indent_id ? String(txn.indent_id) : "",
    // Rebuilt from the stored type + id, the same encoding the form sends.
    source:
      txn.source_type === "STOCK"
        ? "stock"
        : txn.source_type === "DEPARTMENT" && txn.transferred_from_department_id
          ? `dept:${txn.transferred_from_department_id}`
          : txn.source_type === "LOCATION" && txn.transferred_from_location_id
            ? `loc:${txn.transferred_from_location_id}`
            : txn.transferred_from_location_id
              ? `loc:${txn.transferred_from_location_id}`
              : "",
    department_id: txn.department_id ? String(txn.department_id) : "",
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
      <StockForm
        stockBooks={stockBooks}
        departments={departments}
        registers={registers}
        locations={locations}
        indentBooks={indentBooks}
        indents={indents}
        initial={initial}
      />
    </div>
  );
}
