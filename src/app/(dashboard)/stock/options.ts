import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  departmentMasterT,
  itemMasterT,
  stockBookT,
  stockBookMasterT,
  issuedToMasterT,
} from "@/db/schema";

/**
 * Dropdown options shared by the stock entry form on the ledger page and on
 * the edit page — the same pair of lists, loaded once here instead of being
 * written out in both places.
 */
export async function getStockOptions() {
  const [stockBooks, departments, registers, locations] = await Promise.all([
    db
      .select({
        id: stockBookT.id,
        name: sql<string>`concat(coalesce(${itemMasterT.item_name}, 'Item ' || ${stockBookT.item_id}), ' — ', ${stockBookT.location})`,
      })
      .from(stockBookT)
      .leftJoin(itemMasterT, eq(stockBookT.item_id, itemMasterT.id))
      .where(eq(stockBookT.display, "Y"))
      .orderBy(asc(itemMasterT.item_name)),
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
  ]);

  return { stockBooks, departments, registers, locations };
}
