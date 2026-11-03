import { desc, eq, sql, and } from "drizzle-orm";
import { db } from "@/db";
import {
  indentMasterT,
  departmentMasterT,
  indentItemT,
  stockBookMasterT,
  groupItemNameMasterT,
  itemMasterT,
} from "@/db/schema";
import IndentForm from "./indent-form";
import IndentTable, { type IndentLine } from "./indent-table";
import { getIndentOptions } from "./options";

export default async function IndentPage() {
  const { groups, items, makes, models, books, departments, stockBooks } =
    await getIndentOptions();

  const rows = await db
    .select({
      id: indentMasterT.id,
      indent_no: indentMasterT.indent_no,
      indent_date: indentMasterT.indent_date,
      purpose: indentMasterT.purpose,
      status: indentMasterT.status,
      item_type: indentMasterT.item_type,
      department_name: departmentMasterT.department_name,
      has_bill: sql<boolean>`(${indentMasterT.bill_path} is not null)`,
      item_count: sql<number>`count(${indentItemT.id})::int`,
      total_qty: sql<number>`coalesce(sum(${indentItemT.qty_intended}),0)::int`,
      // One entry per line: its register, item (group name, else item name) and
      // page. The table groups these by register.
      lines: sql<IndentLine[]>`coalesce(json_agg(json_build_object(
        'book', ${stockBookMasterT.book_name},
        'item', coalesce(${groupItemNameMasterT.group_name}, ${itemMasterT.item_name}),
        'page', ${indentItemT.stock_book_page_no}
      ) order by ${stockBookMasterT.book_name}, ${indentItemT.sl_no}) filter (where ${indentItemT.id} is not null), '[]')`,
    })
    .from(indentMasterT)
    .leftJoin(
      departmentMasterT,
      eq(indentMasterT.department_id, departmentMasterT.id)
    )
    .leftJoin(
      indentItemT,
      and(eq(indentItemT.indent_id, indentMasterT.id), eq(indentItemT.display, "Y"))
    )
    .leftJoin(stockBookMasterT, eq(indentItemT.stock_book_master_id, stockBookMasterT.id))
    .leftJoin(groupItemNameMasterT, eq(indentItemT.group_id, groupItemNameMasterT.id))
    .leftJoin(itemMasterT, eq(indentItemT.item_id, itemMasterT.id))
    .where(eq(indentMasterT.display, "Y"))
    .groupBy(
      indentMasterT.id,
      indentMasterT.indent_no,
      indentMasterT.indent_date,
      indentMasterT.purpose,
      indentMasterT.status,
      indentMasterT.item_type,
      departmentMasterT.department_name
    )
    .orderBy(desc(indentMasterT.id));

  return (
    <div className="space-y-6">
      <IndentForm
        groups={groups}
        items={items}
        makes={makes}
        models={models}
        books={books}
        departments={departments}
        stockBooks={stockBooks}
      />
      <IndentTable rows={rows} />
    </div>
  );
}
