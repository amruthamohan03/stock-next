import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupItemNameMasterT, itemMasterT, quotationCategoriesT } from "@/db/schema";
import ItemGroupMapClient, { type MapItem } from "./item-group-map-client";

/**
 * Item ↔ Item Group mapping.
 *
 * The item master can set a group one row at a time; this screen exists because
 * most of the migrated items arrived with no group at all, and the stock entry
 * form's Group → Item cascade (and every group filter on the reports) only sees
 * items that carry one. Filing a backlog of items is a bulk job.
 */
export default async function ItemGroupMapPage() {
  const [items, groups] = await Promise.all([
    db
      .select({
        id: itemMasterT.id,
        item_name: itemMasterT.item_name,
        item_code: itemMasterT.item_code,
        category_name: quotationCategoriesT.category_name,
        group_id: itemMasterT.group_id,
      })
      .from(itemMasterT)
      .leftJoin(quotationCategoriesT, eq(itemMasterT.category_id, quotationCategoriesT.id))
      .where(eq(itemMasterT.display, "Y"))
      .orderBy(asc(itemMasterT.item_name)),
    db
      .select({ id: groupItemNameMasterT.id, group_name: groupItemNameMasterT.group_name })
      .from(groupItemNameMasterT)
      .where(eq(groupItemNameMasterT.display, "Y"))
      .orderBy(asc(groupItemNameMasterT.group_name)),
  ]);

  const rows: MapItem[] = items.map((i) => ({
    id: Number(i.id),
    item_name: i.item_name,
    item_code: i.item_code,
    category_name: i.category_name,
    group_id: i.group_id == null ? null : Number(i.group_id),
  }));

  return (
    <ItemGroupMapClient
      rows={rows}
      groups={groups.map((g) => ({ id: Number(g.id), name: g.group_name }))}
    />
  );
}
