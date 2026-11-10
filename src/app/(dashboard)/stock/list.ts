import { aliasedTable, and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  stockTransactionT,
  stockBookT,
  itemMasterT,
  issuedToMasterT,
} from "@/db/schema";

export type StockRow = {
  id: number;
  transaction_date: string;
  item_name: string | null;
  location: string | null;
  transaction_type: string;
  receipt_qty: number | null;
  issue_qty: number | null;
  balance_qty: number | null;
  item_status: string | null;
  to_name: string | null;
  from_name: string | null;
  remarks: string | null;
};

/**
 * The stock ledger list, shared by the web page and the mobile API.
 *
 * The page pulls a block of rows and lets `DataTable` search and page them in
 * the browser; a phone can't hold the whole ledger, so the same query also
 * takes a search term and a window. The match count rides along as a window
 * function rather than a second round trip — which means an `offset` past the
 * end reports a total of 0, since there is no row left to carry it.
 */
export async function getStockRows({
  search = "",
  limit = 500,
  offset = 0,
}: { search?: string; limit?: number; offset?: number } = {}): Promise<{
  rows: StockRow[];
  total: number;
}> {
  const toLoc = aliasedTable(issuedToMasterT, "to_loc");
  const fromLoc = aliasedTable(issuedToMasterT, "from_loc");

  const term = search.trim();
  const where: SQL[] = [eq(stockTransactionT.display, "Y")];
  if (term) {
    const like = `%${term}%`;
    where.push(
      or(
        ilike(itemMasterT.item_name, like),
        ilike(stockBookT.location, like),
        ilike(toLoc.location_name, like),
        ilike(fromLoc.location_name, like),
        ilike(stockTransactionT.remarks, like)
      )!
    );
  }

  const found = await db
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
      total: sql<number>`count(*) over ()`,
    })
    .from(stockTransactionT)
    .leftJoin(stockBookT, eq(stockTransactionT.stock_book_id, stockBookT.id))
    .leftJoin(itemMasterT, eq(stockBookT.item_id, itemMasterT.id))
    .leftJoin(toLoc, eq(stockTransactionT.issued_to_location_id, toLoc.id))
    .leftJoin(
      fromLoc,
      eq(stockTransactionT.transferred_from_location_id, fromLoc.id)
    )
    .where(and(...where))
    .orderBy(desc(stockTransactionT.transaction_date), desc(stockTransactionT.id))
    .limit(limit)
    .offset(offset);

  const total = Number(found[0]?.total ?? 0);
  const rows = found.map(({ total: _total, ...row }) => row);

  return { rows, total };
}
