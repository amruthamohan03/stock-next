import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { daybookItemTypeT, departmentMasterT, stockbookTypeT } from "@/db/schema";

/**
 * Options shared by the two book masters — Indent Book and Stock Book.
 *
 * Server-only: both pages are server components that fetch here and hand plain
 * rows to CrudTable, so the `db` client never reaches the browser bundle.
 */
export type Option = { value: string; label: string };

export async function getBookOptions() {
  const [departments, itemTypes, registerTypes] = await Promise.all([
    db
      .select({ id: departmentMasterT.id, name: departmentMasterT.department_name })
      .from(departmentMasterT)
      .where(eq(departmentMasterT.display, "Y"))
      .orderBy(asc(departmentMasterT.department_name)),
    db
      .select({ id: daybookItemTypeT.id, name: daybookItemTypeT.name })
      .from(daybookItemTypeT)
      .where(eq(daybookItemTypeT.display, "Y"))
      .orderBy(asc(daybookItemTypeT.id)),
    db
      .select({ id: stockbookTypeT.id, name: stockbookTypeT.name })
      .from(stockbookTypeT)
      .where(eq(stockbookTypeT.display, "Y"))
      .orderBy(asc(stockbookTypeT.name)),
  ]);

  const toOptions = (rows: { id: number; name: string | null }[]): Option[] =>
    rows.map((r) => ({ value: String(r.id), label: r.name ?? `#${r.id}` }));

  return {
    departments: toOptions(departments),
    itemTypes: toOptions(itemTypes),
    registerTypes: toOptions(registerTypes),
  };
}

/** Label for one id, or "—" when it is unset and the id itself when unknown. */
export function labelFor(id: unknown, options: Option[]): string {
  // 0 is how a blank select used to be stored; treat it as unset too.
  if (id === null || id === undefined || id === "" || Number(id) === 0) return "—";
  const key = String(id);
  return options.find((o) => o.value === key)?.label ?? `#${key}`;
}

/**
 * Labels for a comma-separated list of ids, e.g. "1,3" → "Consumable, Perishable".
 * An id with no matching option is shown as "#id" rather than dropped, so a
 * deleted item type is visible instead of silently disappearing from the row.
 */
export function labelsFor(csv: unknown, options: Option[]): string {
  const ids = String(csv ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v && v !== "0");
  if (ids.length === 0) return "—";
  return ids.map((id) => options.find((o) => o.value === id)?.label ?? `#${id}`).join(", ");
}
