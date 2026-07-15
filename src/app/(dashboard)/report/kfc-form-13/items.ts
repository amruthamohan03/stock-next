import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { itemMasterT, stockBookT } from "@/db/schema";

export type KfcItem = { id: number; name: string; stock_on_hand: number };

/** All items with their current stock-on-hand (sum of stock-book balance).
 *  Shared by the KFC Form 13 create and edit pages. */
export async function getKfcItems(): Promise<KfcItem[]> {
  const rows = await db
    .select({
      id: itemMasterT.id,
      name: itemMasterT.item_name,
      stock_on_hand: sql<number>`coalesce(sum(${stockBookT.current_balance}), 0)::int`,
    })
    .from(itemMasterT)
    .leftJoin(
      stockBookT,
      and(eq(stockBookT.item_id, itemMasterT.id), eq(stockBookT.display, "Y"))
    )
    .where(eq(itemMasterT.display, "Y"))
    .groupBy(itemMasterT.id, itemMasterT.item_name)
    .orderBy(asc(itemMasterT.item_name));

  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name ?? "",
    stock_on_hand: r.stock_on_hand ?? 0,
  }));
}
