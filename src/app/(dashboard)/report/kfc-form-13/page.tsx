import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { itemMasterT, stockBookT } from "@/db/schema";
import KfcForm13, { type SeedRow } from "./kfc-form-13-table";

// K.F.C. Form 13 (reverse) — annual stock / indent register.
// Seeded dynamically: Article (col 2) and Stock on hand after verification (col 3)
// come from live item + stock-book data; the planning columns are filled in by hand.
export default async function KfcForm13Page() {
  const items = await db
    .select({
      id: itemMasterT.id,
      item_name: itemMasterT.item_name,
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

  const seed: SeedRow[] = items.map((i) => ({
    article: i.item_name ?? "",
    stock_on_hand: i.stock_on_hand ?? 0,
  }));

  return <KfcForm13 seed={seed} />;
}
