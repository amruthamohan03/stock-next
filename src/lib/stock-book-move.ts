import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { recompute, type Tx } from "@/lib/stock-ledger";
import {
  indentItemT,
  indentMasterT,
  itemMasterT,
  groupItemNameMasterT,
  stockBookMasterT,
  stockBookT,
  stockTransactionT,
} from "@/db/schema";

export type MoveSource = "INDENT" | "STOCK";

/** One movable line, as the move form lists it. */
export type MoveLine = {
  id: number;
  /** The indent the line belongs to, so several indents can be listed together. */
  indent_id: number;
  indent_no: string | null;
  indent_date: string | null;
  item_id: number;
  item_name: string;
  group_name: string | null;
  qty: number;
  book_id: number | null;
  book_name: string | null;
  page_no: number | null;
  /** Stock entries only: the date the entry was made. */
  entry_date: string | null;
};

/**
 * The lines of the given indents that can be moved: their items, or the stock
 * entries made against them. Newest indent first, then in line order.
 */
export async function linesFor(source: MoveSource, indentIds: number[]): Promise<MoveLine[]> {
  if (indentIds.length === 0) return [];
  const indentCols = {
    indent_no: indentMasterT.indent_no,
    indent_date: sql<string | null>`${indentMasterT.indent_date}::text`,
  };
  if (source === "INDENT") {
    return db
      .select({
        id: indentItemT.id,
        indent_id: indentItemT.indent_id,
        ...indentCols,
        item_id: indentItemT.item_id,
        item_name: sql<string>`coalesce(${itemMasterT.item_name}, 'Item ' || ${indentItemT.item_id})`,
        group_name: groupItemNameMasterT.group_name,
        qty: sql<number>`coalesce(${indentItemT.qty_intended}, 0)::int`,
        book_id: indentItemT.stock_book_master_id,
        book_name: stockBookMasterT.book_name,
        page_no: indentItemT.stock_book_page_no,
        entry_date: sql<string | null>`null`,
      })
      .from(indentItemT)
      .innerJoin(indentMasterT, eq(indentMasterT.id, indentItemT.indent_id))
      .leftJoin(itemMasterT, eq(itemMasterT.id, indentItemT.item_id))
      .leftJoin(
        groupItemNameMasterT,
        eq(groupItemNameMasterT.id, sql`coalesce(${indentItemT.group_id}, ${itemMasterT.group_id})`)
      )
      .leftJoin(stockBookMasterT, eq(stockBookMasterT.id, indentItemT.stock_book_master_id))
      .where(and(inArray(indentItemT.indent_id, indentIds), eq(indentItemT.display, "Y")))
      .orderBy(desc(indentMasterT.indent_date), desc(indentMasterT.id), asc(indentItemT.sl_no), asc(indentItemT.id));
  }
  return db
    .select({
      id: stockTransactionT.id,
      indent_id: sql<number>`${stockTransactionT.indent_id}`,
      ...indentCols,
      item_id: sql<number>`${stockBookT.item_id}`,
      item_name: sql<string>`coalesce(${itemMasterT.item_name}, 'Item ' || ${stockBookT.item_id})`,
      group_name: groupItemNameMasterT.group_name,
      qty: sql<number>`coalesce(${stockTransactionT.receipt_qty}, 0)::int`,
      book_id: stockTransactionT.stock_book_master_id,
      book_name: stockBookMasterT.book_name,
      page_no: stockTransactionT.stock_book_page_no,
      entry_date: sql<string | null>`${stockTransactionT.transaction_date}::text`,
    })
    .from(stockTransactionT)
    .innerJoin(stockBookT, eq(stockBookT.id, stockTransactionT.stock_book_id))
    .innerJoin(indentMasterT, eq(indentMasterT.id, stockTransactionT.indent_id))
    .leftJoin(itemMasterT, eq(itemMasterT.id, stockBookT.item_id))
    .leftJoin(groupItemNameMasterT, eq(groupItemNameMasterT.id, itemMasterT.group_id))
    .leftJoin(stockBookMasterT, eq(stockBookMasterT.id, stockTransactionT.stock_book_master_id))
    .where(
      and(
        inArray(stockTransactionT.indent_id, indentIds),
        eq(stockTransactionT.display, "Y"),
        // Only entries that brought stock in can be re-entered in another register.
        gt(stockTransactionT.receipt_qty, 0)
      )
    )
    .orderBy(
      desc(indentMasterT.indent_date),
      desc(indentMasterT.id),
      asc(stockTransactionT.transaction_date),
      asc(stockTransactionT.id)
    );
}

/**
 * Move an indent line into the target register (or out of any register, when
 * `toBook` is null). All of it: repoint the line.
 * Part of it: take the quantity off the line and add a copy holding it, with
 * passed/issued figures shared out so the indent's totals don't change.
 */
export async function moveIndentLine(
  tx: Tx,
  lineId: number,
  qty: number,
  toBook: number | null,
  toPage: number | null
) {
  const [line] = await tx.select().from(indentItemT).where(eq(indentItemT.id, lineId));
  const total = line.qty_intended ?? 0;
  if (qty === total) {
    await tx
      .update(indentItemT)
      .set({ stock_book_master_id: toBook, stock_book_page_no: toPage })
      .where(eq(indentItemT.id, lineId));
    return null;
  }
  const remaining = total - qty;
  const passed = line.qty_passed ?? 0;
  const issued = line.qty_issued ?? 0;
  await tx
    .update(indentItemT)
    .set({
      qty_intended: remaining,
      qty_passed: Math.min(passed, remaining),
      qty_issued: Math.min(issued, remaining),
    })
    .where(eq(indentItemT.id, lineId));
  const [{ next }] = await tx
    .select({ next: sql<number>`coalesce(max(${indentItemT.sl_no}), 0)::int + 1` })
    .from(indentItemT)
    .where(eq(indentItemT.indent_id, line.indent_id));
  const { id: _id, created_at: _created, ...rest } = line;
  const [copy] = await tx
    .insert(indentItemT)
    .values({
      ...rest,
      sl_no: next,
      qty_intended: qty,
      qty_passed: Math.max(0, passed - remaining),
      qty_issued: Math.max(0, issued - remaining),
      stock_book_master_id: toBook,
      stock_book_page_no: toPage,
    })
    .returning({ id: indentItemT.id });
  return copy.id;
}

/**
 * Move a stock entry into the target register. Part of it splits the receipt
 * in two within the same ledger, so the ledger's running balance is rebuilt.
 */
export async function moveStockEntry(
  tx: Tx,
  entryId: number,
  qty: number,
  toBook: number | null,
  toPage: number | null,
  userId: number
) {
  const [entry] = await tx.select().from(stockTransactionT).where(eq(stockTransactionT.id, entryId));
  if (qty === (entry.receipt_qty ?? 0)) {
    await tx
      .update(stockTransactionT)
      .set({
        stock_book_master_id: toBook,
        stock_book_page_no: toPage,
        updated_by: userId,
        updated_at: new Date(),
      })
      .where(eq(stockTransactionT.id, entryId));
    return null;
  }
  await tx
    .update(stockTransactionT)
    .set({
      receipt_qty: (entry.receipt_qty ?? 0) - qty,
      updated_by: userId,
      updated_at: new Date(),
    })
    .where(eq(stockTransactionT.id, entryId));
  const { id: _id, created_at: _created, updated_at: _updated, ...rest } = entry;
  const [copy] = await tx
    .insert(stockTransactionT)
    .values({
      ...rest,
      receipt_qty: qty,
      issue_qty: 0,
      balance_qty: 0, // recompute() fills the real figure below
      stock_book_master_id: toBook,
      stock_book_page_no: toPage,
      created_by: userId,
      updated_by: userId,
    })
    .returning({ id: stockTransactionT.id });
  await recompute(tx, entry.stock_book_id);
  return copy.id;
}

/** The parts of a stock_book_move_t row needed to reverse it. */
export type MoveRecord = {
  source_type: string;
  source_record_id: number;
  new_record_id: number | null;
  qty_moved: number;
  from_stock_book_master_id: number | null;
  from_page_no: number | null;
  to_stock_book_master_id: number | null;
  to_page_no: number | null;
};

/**
 * Reverse a move or removal. A whole-line move puts the line back in its old
 * book and page; a partial one folds the split-off copy back into the line it
 * came from. Returns a sentence explaining why when the lines have changed
 * since (moved again, edited, deleted), so a later change is never clobbered.
 */
export async function undoMove(tx: Tx, rec: MoveRecord): Promise<string | null> {
  const inTarget = (book: number | null, page: number | null) =>
    book === rec.to_stock_book_master_id && page === rec.to_page_no;
  const changed =
    "The item has been moved, edited or deleted since, so this can no longer be undone.";

  if (rec.source_type === "INDENT") {
    const [src] = await tx.select().from(indentItemT).where(eq(indentItemT.id, rec.source_record_id));
    if (!src || src.display !== "Y") return changed;
    if (rec.new_record_id === null) {
      if (!inTarget(src.stock_book_master_id, src.stock_book_page_no)) return changed;
      await tx
        .update(indentItemT)
        .set({ stock_book_master_id: rec.from_stock_book_master_id, stock_book_page_no: rec.from_page_no })
        .where(eq(indentItemT.id, src.id));
      return null;
    }
    const [copy] = await tx.select().from(indentItemT).where(eq(indentItemT.id, rec.new_record_id));
    if (
      !copy ||
      copy.display !== "Y" ||
      copy.qty_intended !== rec.qty_moved ||
      !inTarget(copy.stock_book_master_id, copy.stock_book_page_no)
    )
      return changed;
    await tx
      .update(indentItemT)
      .set({
        qty_intended: (src.qty_intended ?? 0) + (copy.qty_intended ?? 0),
        qty_passed: (src.qty_passed ?? 0) + (copy.qty_passed ?? 0),
        qty_issued: (src.qty_issued ?? 0) + (copy.qty_issued ?? 0),
      })
      .where(eq(indentItemT.id, src.id));
    await tx.update(indentItemT).set({ display: "N" }).where(eq(indentItemT.id, copy.id));
    return null;
  }

  const [src] = await tx
    .select()
    .from(stockTransactionT)
    .where(eq(stockTransactionT.id, rec.source_record_id));
  if (!src || src.display !== "Y") return changed;
  if (rec.new_record_id === null) {
    if (!inTarget(src.stock_book_master_id, src.stock_book_page_no)) return changed;
    await tx
      .update(stockTransactionT)
      .set({
        stock_book_master_id: rec.from_stock_book_master_id,
        stock_book_page_no: rec.from_page_no,
        updated_at: new Date(),
      })
      .where(eq(stockTransactionT.id, src.id));
    return null;
  }
  const [copy] = await tx
    .select()
    .from(stockTransactionT)
    .where(eq(stockTransactionT.id, rec.new_record_id));
  if (
    !copy ||
    copy.display !== "Y" ||
    copy.receipt_qty !== rec.qty_moved ||
    copy.stock_book_id !== src.stock_book_id ||
    !inTarget(copy.stock_book_master_id, copy.stock_book_page_no)
  )
    return changed;
  await tx
    .update(stockTransactionT)
    .set({ receipt_qty: (src.receipt_qty ?? 0) + (copy.receipt_qty ?? 0), updated_at: new Date() })
    .where(eq(stockTransactionT.id, src.id));
  await tx
    .update(stockTransactionT)
    .set({ display: "N", updated_at: new Date() })
    .where(eq(stockTransactionT.id, copy.id));
  await recompute(tx, src.stock_book_id);
  return null;
}
