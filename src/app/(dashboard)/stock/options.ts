import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  departmentMasterT,
  itemMasterT,
  stockBookT,
  stockBookMasterT,
  issuedToMasterT,
  indentBookT,
  indentMasterT,
} from "@/db/schema";

/**
 * Dropdown options shared by the stock entry form on the ledger page and on
 * the edit page — the same pair of lists, loaded once here instead of being
 * written out in both places.
 */
export async function getStockOptions() {
  const [stockBooks, departments, registers, locations, indentBooks, indents] =
    await Promise.all([
    // Every item the store knows about, whether or not it has a ledger row yet.
    //
    // The picker used to list stock_book_t rows, so an item without one — 77 of
    // the 151 in the master — could never be chosen. Items with a ledger keep
    // pointing at it ("book:<id>"); the rest come through as "item:<id>" and
    // get their ledger row created on the first entry.
    //
    // A few items have several ledger rows, so those carry a qualifier: the
    // location when it tells them apart, otherwise the row's own number,
    // because posting against the wrong row would hit the wrong balance.
    db.execute(sql`
      SELECT key, name, has_ledger
      FROM (
        SELECT 'book:' || id AS key,
               CASE
                 WHEN n_item = 1 THEN item_name
                 WHEN min_loc <> max_loc AND n_item_loc = 1 THEN item_name || ' — ' || loc
                 WHEN min_loc <> max_loc THEN item_name || ' — ' || loc || ' · #' || id
                 ELSE item_name || ' · #' || id
               END AS name,
               item_name AS sort_name,
               true AS has_ledger
        FROM (
          SELECT sb.id,
                 COALESCE(im.item_name, 'Item ' || sb.item_id) AS item_name,
                 COALESCE(l.location_name, sb.location, '—') AS loc,
                 COUNT(*) OVER (PARTITION BY sb.item_id) AS n_item,
                 MIN(COALESCE(l.location_name, sb.location, '—')) OVER (PARTITION BY sb.item_id) AS min_loc,
                 MAX(COALESCE(l.location_name, sb.location, '—')) OVER (PARTITION BY sb.item_id) AS max_loc,
                 COUNT(*) OVER (
                   PARTITION BY sb.item_id, COALESCE(l.location_name, sb.location, '—')
                 ) AS n_item_loc
          FROM stock_book_t sb
          LEFT JOIN item_master_t im ON im.id = sb.item_id
          LEFT JOIN issued_to_master_t l ON l.id = sb.location_id
          WHERE sb.display = 'Y'
        ) x

        UNION ALL

        SELECT 'item:' || im.id AS key, im.item_name AS name, im.item_name AS sort_name, false AS has_ledger
        FROM item_master_t im
        WHERE im.display = 'Y'
          AND NOT EXISTS (
            SELECT 1 FROM stock_book_t sb WHERE sb.item_id = im.id AND sb.display = 'Y'
          )
      ) all_items
      ORDER BY sort_name ASC, name ASC
    `),
    db
      .select({ id: departmentMasterT.id, name: departmentMasterT.department_name })
      .from(departmentMasterT)
      .where(eq(departmentMasterT.display, "Y"))
      .orderBy(asc(departmentMasterT.department_name)),
    // The physical stock registers from the Stock Book master.
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
    // Where stock can be issued to, from the Location master.
    db
      .select({ id: issuedToMasterT.id, name: issuedToMasterT.location_name })
      .from(issuedToMasterT)
      .where(eq(issuedToMasterT.display, "Y"))
      .orderBy(asc(issuedToMasterT.location_name)),
    // The indent an entry can be booked against: the book first, then the
    // indents inside it.
    db
      .select({ id: indentBookT.id, name: indentBookT.book_name, book_no: indentBookT.book_no })
      .from(indentBookT)
      .where(eq(indentBookT.display, "Y"))
      .orderBy(asc(indentBookT.book_name)),
    db
      .select({
        id: indentMasterT.id,
        indent_no: indentMasterT.indent_no,
        indent_date: indentMasterT.indent_date,
        book_no: indentMasterT.book_no,
        department_id: indentMasterT.department_id,
      })
      .from(indentMasterT)
      .where(eq(indentMasterT.display, "Y"))
      .orderBy(desc(indentMasterT.indent_date)),
  ]);

  return {
    stockBooks: (
      stockBooks as unknown as { key: string; name: string; has_ledger: boolean }[]
    ).map((b) => ({
      key: String(b.key),
      name: String(b.name),
      has_ledger: Boolean(b.has_ledger),
    })),
    departments,
    registers,
    locations,
    indentBooks,
    indents: indents.map((i) => ({
      ...i,
      indent_date: i.indent_date ? String(i.indent_date).slice(0, 10) : null,
    })),
  };
}
