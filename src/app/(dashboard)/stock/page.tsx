import { aliasedTable, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  stockTransactionT,
  stockBookT,
  itemMasterT,
  issuedToMasterT,
} from "@/db/schema";
import StockTable from "./stock-table";
import StockForm from "./stock-form";

export default async function StockLedgerPage() {
  const toLoc = aliasedTable(issuedToMasterT, "to_loc");
  const fromLoc = aliasedTable(issuedToMasterT, "from_loc");

  const stockBooksPromise = db
    .select({
      id: stockBookT.id,
      name: sql<string>`concat(coalesce(${itemMasterT.item_name}, 'Item ' || ${stockBookT.item_id}), ' — ', ${stockBookT.location})`,
    })
    .from(stockBookT)
    .leftJoin(itemMasterT, eq(stockBookT.item_id, itemMasterT.id))
    .where(eq(stockBookT.display, "Y"))
    .orderBy(asc(itemMasterT.item_name));

  const rowsPromise = db
    .select({
      id: stockTransactionT.id,
      transaction_date: stockTransactionT.transaction_date,
      item_name: itemMasterT.item_name,
      location: stockBookT.location,
      transaction_type: stockTransactionT.transaction_type,
      receipt_qty: stockTransactionT.receipt_qty,
      issue_qty: stockTransactionT.issue_qty,
      balance_qty: stockTransactionT.balance_qty,
      item_status: stockTransactionT.item_status,
      to_name: toLoc.location_name,
      from_name: fromLoc.location_name,
      remarks: stockTransactionT.remarks,
    })
    .from(stockTransactionT)
    .leftJoin(stockBookT, eq(stockTransactionT.stock_book_id, stockBookT.id))
    .leftJoin(itemMasterT, eq(stockBookT.item_id, itemMasterT.id))
    .leftJoin(toLoc, eq(stockTransactionT.issued_to_location_id, toLoc.id))
    .leftJoin(
      fromLoc,
      eq(stockTransactionT.transferred_from_location_id, fromLoc.id)
    )
    .where(eq(stockTransactionT.display, "Y"))
    .orderBy(desc(stockTransactionT.transaction_date), desc(stockTransactionT.id))
    .limit(500);

  const [rows, stockBooks] = await Promise.all([rowsPromise, stockBooksPromise]);

  return (
    <div className="space-y-6">
      <StockForm stockBooks={stockBooks} />
      <StockTable rows={rows} />
    </div>
  );
}
