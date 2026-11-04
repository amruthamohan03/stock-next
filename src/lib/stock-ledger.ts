import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { stockTransactionT, stockBookT } from "@/db/schema";

/** A transaction handle from db.transaction(). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Recompute the running balance for every visible transaction of a stock book
 * (ordered by date, then id) and store the final figure on the stock book.
 * Called after any create / edit / delete so the ledger stays consistent.
 */
export async function recompute(
  tx: Tx,
  bookId: number
) {
  const rows = await tx
    .select({
      id: stockTransactionT.id,
      receipt_qty: stockTransactionT.receipt_qty,
      issue_qty: stockTransactionT.issue_qty,
    })
    .from(stockTransactionT)
    .where(and(eq(stockTransactionT.stock_book_id, bookId), eq(stockTransactionT.display, "Y")))
    .orderBy(asc(stockTransactionT.transaction_date), asc(stockTransactionT.id));

  let running = 0;
  for (const r of rows) {
    running += (r.receipt_qty ?? 0) - (r.issue_qty ?? 0);
    await tx
      .update(stockTransactionT)
      .set({ balance_qty: running })
      .where(eq(stockTransactionT.id, r.id));
  }

  await tx
    .update(stockBookT)
    .set({ current_balance: running, updated_at: new Date() })
    .where(eq(stockBookT.id, bookId));
}
