import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { usersT, roleMasterT } from "@/db/schema";

export type Signatory = { id: number; name: string; designation: string };

/** Active users offered as signatories (the person who signs a KFC form or
 *  document — may differ from the creator). Designation defaults to their role. */
export async function getSignatories(): Promise<Signatory[]> {
  const rows = await db
    .select({
      id: usersT.id,
      name: usersT.full_name,
      designation: roleMasterT.role_name,
    })
    .from(usersT)
    .leftJoin(roleMasterT, eq(usersT.role_id, roleMasterT.id))
    .where(eq(usersT.display, "Y"))
    .orderBy(asc(usersT.full_name));

  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name ?? "",
    designation: r.designation ?? "",
  }));
}
