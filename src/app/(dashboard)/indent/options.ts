import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  groupItemNameMasterT,
  itemMasterT,
  makeT,
  modelT,
  indentBookT,
  departmentMasterT,
} from "@/db/schema";

/** Dropdown options shared by the create and edit indent pages. */
export async function getIndentOptions() {
  const [groups, items, makes, models, books, departments] = await Promise.all([
    db
      .select({ id: groupItemNameMasterT.id, name: groupItemNameMasterT.group_name })
      .from(groupItemNameMasterT)
      .where(eq(groupItemNameMasterT.display, "Y"))
      .orderBy(asc(groupItemNameMasterT.group_name)),
    db
      .select({ id: itemMasterT.id, name: itemMasterT.item_name })
      .from(itemMasterT)
      .where(eq(itemMasterT.display, "Y"))
      .orderBy(asc(itemMasterT.item_name)),
    db
      .select({ id: makeT.id, name: makeT.make_name })
      .from(makeT)
      .where(eq(makeT.display, "Y"))
      .orderBy(asc(makeT.make_name)),
    db
      .select({ id: modelT.id, name: modelT.model_name, make_id: modelT.make_id })
      .from(modelT)
      .where(eq(modelT.display, "Y"))
      .orderBy(asc(modelT.model_name)),
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
      .select({ id: departmentMasterT.id, name: departmentMasterT.department_name })
      .from(departmentMasterT)
      .where(eq(departmentMasterT.display, "Y"))
      .orderBy(asc(departmentMasterT.department_name)),
  ]);
  return { groups, items, makes, models, books, departments };
}
