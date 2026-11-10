import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
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
  /** Which table the line lives in: an indent item or a stock receipt. */
  kind: MoveSource;
  id: number;
  /** The indent the line belongs to (a stock entry may have none). */
  indent_id: number | null;
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

type Where = Parameters<typeof and>[number];

/** Indent items matching `where`, as movable lines. */
function indentLines(where: Where) {
  return db
    .select({
      kind: sql<MoveSource>`'INDENT'`,
      id: indentItemT.id,
      indent_id: sql<number | null>`${indentItemT.indent_id}`,
      indent_no: indentMasterT.indent_no,
      indent_date: sql<string | null>`${indentMasterT.indent_date}::text`,
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
    .innerJoin(indentMasterT, and(eq(indentMasterT.id, indentItemT.indent_id), eq(indentMasterT.display, "Y")))
    .leftJoin(itemMasterT, eq(itemMasterT.id, indentItemT.item_id))
    .leftJoin(
      groupItemNameMasterT,
      eq(groupItemNameMasterT.id, sql`coalesce(${indentItemT.group_id}, ${itemMasterT.group_id})`)
    )
    .leftJoin(stockBookMasterT, eq(stockBookMasterT.id, indentItemT.stock_book_master_id))
    .where(and(where, eq(indentItemT.display, "Y")))
    .orderBy(desc(indentMasterT.indent_date), desc(indentMasterT.id), asc(indentItemT.sl_no), asc(indentItemT.id));
}

/** Stock receipts matching `where`, as movable lines (with their indent, if any). */
function stockLines(where: Where) {
  return db
    .select({
      kind: sql<MoveSource>`'STOCK'`,
      id: stockTransactionT.id,
      indent_id: sql<number | null>`${stockTransactionT.indent_id}`,
      indent_no: indentMasterT.indent_no,
      indent_date: sql<string | null>`${indentMasterT.indent_date}::text`,
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
    .leftJoin(indentMasterT, eq(indentMasterT.id, stockTransactionT.indent_id))
    .leftJoin(itemMasterT, eq(itemMasterT.id, stockBookT.item_id))
    .leftJoin(groupItemNameMasterT, eq(groupItemNameMasterT.id, itemMasterT.group_id))
    .leftJoin(stockBookMasterT, eq(stockBookMasterT.id, stockTransactionT.stock_book_master_id))
    .where(
      and(
        where,
        eq(stockTransactionT.display, "Y"),
        // Only entries that brought stock in can be re-entered in another register.
        gt(stockTransactionT.receipt_qty, 0)
      )
    )
    .orderBy(asc(stockTransactionT.transaction_date), asc(stockTransactionT.id));
}

/** The items of the given indents, newest indent first, then in line order. */
export async function indentItemsOf(indentIds: number[]): Promise<MoveLine[]> {
  if (indentIds.length === 0) return [];
  return indentLines(inArray(indentItemT.indent_id, indentIds));
}

/**
 * Everything written on one page of a stock register: the indent items entered
 * there and the stock receipts recorded there. `page` null means entries in
 * that register with no page number.
 */
export async function pageEntries(bookId: number, page: number | null): Promise<MoveLine[]> {
  const [items, stock] = await Promise.all([
    indentLines(
      and(
        eq(indentItemT.stock_book_master_id, bookId),
        page === null ? isNull(indentItemT.stock_book_page_no) : eq(indentItemT.stock_book_page_no, page)
      )
    ),
    stockLines(
      and(
        eq(stockTransactionT.stock_book_master_id, bookId),
        page === null
          ? isNull(stockTransactionT.stock_book_page_no)
          : eq(stockTransactionT.stock_book_page_no, page)
      )
    ),
  ]);
  return [...items, ...stock];
}

/** A line's identity across both tables (their ids can collide). */
export const lineKey = (l: { kind: MoveSource; id: number }) => `${l.kind}:${l.id}`;

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

/** Raised inside a transaction to abort it with a message the user can act on. */
export class MoveRefused extends Error {}

/** Current running balance of one stock ledger row. */
async function ledgerBalance(tx: Tx, ledgerId: number) {
  const [row] = await tx
    .select({ balance: stockBookT.current_balance })
    .from(stockBookT)
    .where(eq(stockBookT.id, ledgerId));
  return row?.balance ?? 0;
}

/**
 * Take a quantity of a stock entry out of the stock book. All of it: the entry
 * is soft-deleted (as the Stock page's delete does). Part of it: the received
 * quantity goes down. The ledger is rebuilt either way, and the removal is
 * refused if it would leave the balance below zero — that stock was issued.
 */
export async function removeStockQty(tx: Tx, entryId: number, qty: number, userId: number) {
  const [entry] = await tx.select().from(stockTransactionT).where(eq(stockTransactionT.id, entryId));
  const full = qty === (entry.receipt_qty ?? 0);
  await tx
    .update(stockTransactionT)
    .set(
      full
        ? { display: "N", updated_by: userId, updated_at: new Date() }
        : { receipt_qty: (entry.receipt_qty ?? 0) - qty, updated_by: userId, updated_at: new Date() }
    )
    .where(eq(stockTransactionT.id, entryId));
  await recompute(tx, entry.stock_book_id);
  if ((await ledgerBalance(tx, entry.stock_book_id)) < 0) {
    throw new MoveRefused(
      "Some of this stock has already been issued, so that much can't be removed from the stock book."
    );
  }
}

/** Next free line number on an indent. */
async function nextSlNo(tx: Tx, indentId: number) {
  const [{ next }] = await tx
    .select({ next: sql<number>`coalesce(max(${indentItemT.sl_no}), 0)::int + 1` })
    .from(indentItemT)
    .where(eq(indentItemT.indent_id, indentId));
  return next;
}

/**
 * The indent with this number and date in the target indent book, created if
 * it doesn't exist yet. A new one copies the department, type and purpose of
 * the indent the items come from.
 */
export async function resolveTargetIndent(
  tx: Tx,
  target: { bookId: number; indentNo: string; indentDate: string },
  fromIndentId: number,
  userId: number
): Promise<{ id: number; created: boolean }> {
  const [found] = await tx
    .select({ id: indentMasterT.id })
    .from(indentMasterT)
    .where(
      and(
        eq(indentMasterT.book_no, target.bookId),
        eq(indentMasterT.indent_no, target.indentNo),
        eq(indentMasterT.indent_date, target.indentDate),
        eq(indentMasterT.display, "Y")
      )
    )
    .orderBy(asc(indentMasterT.id))
    .limit(1);
  if (found) return { id: found.id, created: false };

  const [from] = await tx.select().from(indentMasterT).where(eq(indentMasterT.id, fromIndentId));
  const [made] = await tx
    .insert(indentMasterT)
    .values({
      book_no: target.bookId,
      indent_no: target.indentNo,
      indent_date: target.indentDate,
      department_id: from?.department_id ?? 1,
      institution_id: from?.institution_id ?? 1,
      item_type: from?.item_type ?? "N",
      purpose: from?.purpose ?? null,
      no_stock_entry: from?.no_stock_entry ?? "N",
      status: "CREATED",
      created_by: userId,
      display: "Y",
    })
    .returning({ id: indentMasterT.id });
  return { id: made.id, created: true };
}

/**
 * Move an indent line onto another indent. All of it: the line changes indent
 * (and stock entries posted against it follow). Part of it: the quantity is
 * split off into a copy on the target indent, with passed/issued shared out as
 * in a stock-book split. The stock book and page stay as they were.
 */
export async function moveLineToIndent(tx: Tx, lineId: number, qty: number, toIndentId: number) {
  const [line] = await tx.select().from(indentItemT).where(eq(indentItemT.id, lineId));
  const slNo = await nextSlNo(tx, toIndentId);
  const total = line.qty_intended ?? 0;
  if (qty === total) {
    await tx
      .update(indentItemT)
      .set({ indent_id: toIndentId, sl_no: slNo })
      .where(eq(indentItemT.id, lineId));
    await tx
      .update(stockTransactionT)
      .set({ indent_id: toIndentId, updated_at: new Date() })
      .where(eq(stockTransactionT.indent_item_id, lineId));
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
  const { id: _id, created_at: _created, ...rest } = line;
  const [copy] = await tx
    .insert(indentItemT)
    .values({
      ...rest,
      indent_id: toIndentId,
      sl_no: slNo,
      qty_intended: qty,
      qty_passed: Math.max(0, passed - remaining),
      qty_issued: Math.max(0, issued - remaining),
    })
    .returning({ id: indentItemT.id });
  return copy.id;
}

/** Reverse moveLineToIndent; see undoMove for the contract. */
async function undoIndentMove(tx: Tx, rec: MoveRecord, changed: string): Promise<string | null> {
  const fromIndent = rec.indent_id;
  if (fromIndent === null) return changed;
  const [src] = await tx.select().from(indentItemT).where(eq(indentItemT.id, rec.source_record_id));
  if (!src || src.display !== "Y") return changed;
  if (rec.new_record_id === null) {
    if (src.indent_id !== rec.to_indent_id) return changed;
    await tx
      .update(indentItemT)
      .set({ indent_id: fromIndent, sl_no: await nextSlNo(tx, fromIndent) })
      .where(eq(indentItemT.id, src.id));
    await tx
      .update(stockTransactionT)
      .set({ indent_id: fromIndent, updated_at: new Date() })
      .where(eq(stockTransactionT.indent_item_id, src.id));
  } else {
    const [copy] = await tx.select().from(indentItemT).where(eq(indentItemT.id, rec.new_record_id));
    if (!copy || copy.display !== "Y" || copy.indent_id !== rec.to_indent_id || copy.qty_intended !== rec.qty_moved)
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
  }
  // An indent this move created goes again once nothing is left on it.
  if (rec.created_indent === "Y" && rec.to_indent_id) {
    const [left] = await tx
      .select({ id: indentItemT.id })
      .from(indentItemT)
      .where(and(eq(indentItemT.indent_id, rec.to_indent_id), eq(indentItemT.display, "Y")))
      .limit(1);
    if (!left)
      await tx
        .update(indentMasterT)
        .set({ display: "N", updated_at: new Date() })
        .where(eq(indentMasterT.id, rec.to_indent_id));
  }
  return null;
}

/** The parts of a stock_book_move_t row needed to reverse it. */
export type MoveRecord = {
  source_type: string;
  action: string;
  indent_id: number | null;
  to_indent_id: number | null;
  created_indent: string;
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

  // Moved to another indent rather than another stock register.
  if (rec.to_indent_id !== null) return undoIndentMove(tx, rec, changed);

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

  // A stock-entry removal took quantity out of the stock book: put it back.
  if (rec.action === "REMOVE") {
    if (!src) return changed;
    if (src.display === "N") {
      // Removed whole; restore it only if nothing else has touched it.
      if (src.receipt_qty !== rec.qty_moved) return changed;
      await tx
        .update(stockTransactionT)
        .set({ display: "Y", updated_at: new Date() })
        .where(eq(stockTransactionT.id, src.id));
    } else {
      await tx
        .update(stockTransactionT)
        .set({ receipt_qty: (src.receipt_qty ?? 0) + rec.qty_moved, updated_at: new Date() })
        .where(eq(stockTransactionT.id, src.id));
    }
    await recompute(tx, src.stock_book_id);
    return null;
  }

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
