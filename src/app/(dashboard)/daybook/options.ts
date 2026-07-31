import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  stockbookTypeT,
  daybookUnitT,
  itemMasterT,
  serviceProvidersT,
  issuedToMasterT,
  usersT,
} from "@/db/schema";

export type Opt = { id: number; name: string };

/** Every dropdown the Day Book form needs. Shared by the create and edit pages. */
export async function getDaybookOptions(): Promise<{
  stockbookTypes: Opt[];
  units: Opt[];
  items: Opt[];
  providers: Opt[];
  issuedTo: Opt[];
  users: Opt[];
}> {
  const [types, units, items, providers, issuedTo, users] = await Promise.all([
    db
      .select({ id: stockbookTypeT.id, name: stockbookTypeT.name })
      .from(stockbookTypeT)
      .where(eq(stockbookTypeT.display, "Y"))
      .orderBy(asc(stockbookTypeT.name)),
    db
      .select({ id: daybookUnitT.id, name: daybookUnitT.name })
      .from(daybookUnitT)
      .where(eq(daybookUnitT.display, "Y"))
      .orderBy(asc(daybookUnitT.name)),
    db
      .select({ id: itemMasterT.id, name: itemMasterT.item_name })
      .from(itemMasterT)
      .where(eq(itemMasterT.display, "Y"))
      .orderBy(asc(itemMasterT.item_name)),
    db
      .select({ id: serviceProvidersT.id, name: serviceProvidersT.provider_name })
      .from(serviceProvidersT)
      .where(eq(serviceProvidersT.display, "Y"))
      .orderBy(asc(serviceProvidersT.provider_name)),
    // NOTE: this table stores the label in `location_name` (the PHP called it `name`).
    db
      .select({ id: issuedToMasterT.id, name: issuedToMasterT.location_name })
      .from(issuedToMasterT)
      .where(eq(issuedToMasterT.display, "Y"))
      .orderBy(asc(issuedToMasterT.location_name)),
    db
      .select({ id: usersT.id, name: usersT.full_name })
      .from(usersT)
      .where(eq(usersT.display, "Y"))
      .orderBy(asc(usersT.full_name)),
  ]);

  const norm = (rows: { id: number | string; name: string | null }[]): Opt[] =>
    rows.map((r) => ({ id: Number(r.id), name: r.name ?? "" }));

  return {
    stockbookTypes: norm(types),
    units: norm(units),
    items: norm(items),
    providers: norm(providers),
    issuedTo: norm(issuedTo),
    users: norm(users),
  };
}
