import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stockBookT, itemMasterT } from "@/db/schema";
import StockBooksTable from "./stockbooks-table";

// Ports StockController::stockBooks — the per-item/location on-hand balance list.
export default async function StockBooksPage() {
  const rows = await db
    .select({
      id: stockBookT.id,
      item_name: itemMasterT.item_name,
      location: stockBookT.location,
      opening_balance: stockBookT.opening_balance,
      current_balance: stockBookT.current_balance,
      updated_at: stockBookT.updated_at,
    })
    .from(stockBookT)
    .leftJoin(itemMasterT, eq(stockBookT.item_id, itemMasterT.id))
    .where(eq(stockBookT.display, "Y"))
    .orderBy(itemMasterT.item_name, stockBookT.location);

  return <StockBooksTable rows={rows} />;
}
