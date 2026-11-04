import { asc, desc, eq } from "drizzle-orm";
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
import MoveForm from "./move-form";
import MoveHistory from "./move-history";

export default async function StockBookMovePage() {
  const fromBook = alias(stockBookMasterT, "from_book");
  const toBook = alias(stockBookMasterT, "to_book");

  const [session, indents, stockBooks, users, history] = await Promise.all([
    getSession(),
    db
      .select({
        id: indentMasterT.id,
        indent_no: indentMasterT.indent_no,
        indent_date: indentMasterT.indent_date,
        book_name: indentBookT.book_name,
      })
      .from(indentMasterT)
      .leftJoin(indentBookT, eq(indentBookT.id, indentMasterT.book_no))
      .where(eq(indentMasterT.display, "Y"))
      .orderBy(desc(indentMasterT.indent_date), desc(indentMasterT.id)),
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
        item_name: itemMasterT.item_name,
        qty_moved: stockBookMoveT.qty_moved,
        from_book: fromBook.book_name,
        from_page: stockBookMoveT.from_page_no,
        to_book: toBook.book_name,
        to_page: stockBookMoveT.to_page_no,
        moved_by_id: stockBookMoveT.moved_by,
        moved_by: usersT.full_name,
        remarks: stockBookMoveT.remarks,
      })
      .from(stockBookMoveT)
      .leftJoin(indentMasterT, eq(indentMasterT.id, stockBookMoveT.indent_id))
      .leftJoin(itemMasterT, eq(itemMasterT.id, stockBookMoveT.item_id))
      .leftJoin(fromBook, eq(fromBook.id, stockBookMoveT.from_stock_book_master_id))
      .leftJoin(toBook, eq(toBook.id, stockBookMoveT.to_stock_book_master_id))
      .leftJoin(usersT, eq(usersT.id, stockBookMoveT.moved_by))
      .where(eq(stockBookMoveT.display, "Y"))
      .orderBy(desc(stockBookMoveT.moved_date), desc(stockBookMoveT.id)),
  ]);

  return (
    <div className="space-y-6">
      <MoveForm
        indents={indents}
        stockBooks={stockBooks}
        users={users}
        currentUserId={session?.id ?? null}
      />
      <MoveHistory rows={history} users={users} />
    </div>
  );
}
