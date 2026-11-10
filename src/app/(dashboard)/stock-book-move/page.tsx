import { asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import {
  indentBookT,
  indentMasterT,
  itemMasterT,
  stockBookMasterT,
  stockBookMoveT,
  usersT,
} from "@/db/schema";
import MoveForm, { type PageCount } from "./move-form";
import MoveHistory from "./move-history";

export default async function StockBookMovePage() {
  const fromBook = alias(stockBookMasterT, "from_book");
  const toBook = alias(stockBookMasterT, "to_book");
  const fromIndentBook = alias(indentBookT, "from_indent_book");
  const toIndent = alias(indentMasterT, "to_indent");
  const toIndentBook = alias(indentBookT, "to_indent_book");

  const [session, indents, indentBooks, stockBooks, pages, users, history] = await Promise.all([
    getSession(),
    db
      .select({
        id: indentMasterT.id,
        book_id: indentMasterT.book_no,
        indent_no: indentMasterT.indent_no,
        indent_date: sql<string>`${indentMasterT.indent_date}::text`,
        // What each indent still has to move or remove; the form lists only
        // indents with something left for the chosen action.
        item_count: sql<number>`(select count(*)::int from indent_item_t ii
          where ii.indent_id = ${indentMasterT.id} and ii.display = 'Y')`,
        booked_item_count: sql<number>`(select count(*)::int from indent_item_t ii
          where ii.indent_id = ${indentMasterT.id} and ii.display = 'Y'
            and ii.stock_book_master_id is not null)`,
      })
      .from(indentMasterT)
      .where(eq(indentMasterT.display, "Y"))
      .orderBy(desc(indentMasterT.indent_date), desc(indentMasterT.id)),
    db
      .select({
        id: indentBookT.id,
        name: indentBookT.book_name,
        book_no: indentBookT.book_no,
        volume: indentBookT.volume,
      })
      .from(indentBookT)
      .where(eq(indentBookT.display, "Y"))
      .orderBy(asc(indentBookT.book_name)),
    db
      .select({
        id: stockBookMasterT.id,
        name: stockBookMasterT.book_name,
        book_no: stockBookMasterT.book_no,
        volume: stockBookMasterT.volume,
      })
      .from(stockBookMasterT)
      .where(eq(stockBookMasterT.display, "Y"))
      .orderBy(asc(stockBookMasterT.book_name)),
    // Pages in use per stock register, counting indent items written there and
    // stock receipts recorded there. Page 0 stands for "no page number".
    db.execute(sql`
      SELECT book_id, page_no, COUNT(*)::int AS entries FROM (
        SELECT ii.stock_book_master_id AS book_id, COALESCE(ii.stock_book_page_no, 0) AS page_no
        FROM indent_item_t ii
        JOIN indent_master_t im ON im.id = ii.indent_id AND im.display = 'Y'
        WHERE ii.display = 'Y' AND ii.stock_book_master_id IS NOT NULL
        UNION ALL
        SELECT st.stock_book_master_id, COALESCE(st.stock_book_page_no, 0)
        FROM stock_transaction_t st
        WHERE st.display = 'Y' AND st.receipt_qty > 0 AND st.stock_book_master_id IS NOT NULL
      ) e
      GROUP BY book_id, page_no
      ORDER BY book_id, page_no
    `) as unknown as Promise<PageCount[]>,
    db
      .select({ id: usersT.id, name: usersT.full_name })
      .from(usersT)
      .where(eq(usersT.display, "Y"))
      .orderBy(asc(usersT.full_name)),
    db
      .select({
        id: stockBookMoveT.id,
        source_type: stockBookMoveT.source_type,
        action: stockBookMoveT.action,
        moved_date: stockBookMoveT.moved_date,
        indent_no: indentMasterT.indent_no,
        indent_date: indentMasterT.indent_date,
        indent_book: fromIndentBook.book_name,
        item_name: itemMasterT.item_name,
        qty_moved: stockBookMoveT.qty_moved,
        from_book: fromBook.book_name,
        from_page: stockBookMoveT.from_page_no,
        to_book: toBook.book_name,
        to_page: stockBookMoveT.to_page_no,
        to_indent_no: toIndent.indent_no,
        to_indent_date: sql<string | null>`${toIndent.indent_date}::text`,
        to_indent_book: toIndentBook.book_name,
        moved_by_id: stockBookMoveT.moved_by,
        moved_by: usersT.full_name,
        remarks: stockBookMoveT.remarks,
      })
      .from(stockBookMoveT)
      .leftJoin(indentMasterT, eq(indentMasterT.id, stockBookMoveT.indent_id))
      .leftJoin(fromIndentBook, eq(fromIndentBook.id, indentMasterT.book_no))
      .leftJoin(itemMasterT, eq(itemMasterT.id, stockBookMoveT.item_id))
      .leftJoin(fromBook, eq(fromBook.id, stockBookMoveT.from_stock_book_master_id))
      .leftJoin(toBook, eq(toBook.id, stockBookMoveT.to_stock_book_master_id))
      .leftJoin(toIndent, eq(toIndent.id, stockBookMoveT.to_indent_id))
      .leftJoin(toIndentBook, eq(toIndentBook.id, toIndent.book_no))
      .leftJoin(usersT, eq(usersT.id, stockBookMoveT.moved_by))
      .where(eq(stockBookMoveT.display, "Y"))
      .orderBy(desc(stockBookMoveT.moved_date), desc(stockBookMoveT.id)),
  ]);

  return (
    <div className="space-y-6">
      <MoveForm
        indents={indents}
        indentBooks={indentBooks}
        stockBooks={stockBooks}
        pages={pages}
        users={users}
        currentUserId={session?.id ?? null}
      />
      <MoveHistory rows={history} users={users} />
    </div>
  );
}
