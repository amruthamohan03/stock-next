import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roleMasterT } from "@/db/schema";
import RoleMenuClient from "./role-menu-client";

export default async function RoleMenuMappingPage() {
  const roles = await db
    .select({ id: roleMasterT.id, role_name: roleMasterT.role_name })
    .from(roleMasterT)
    .where(eq(roleMasterT.display, "Y"))
    .orderBy(asc(roleMasterT.role_name));

  return <RoleMenuClient roles={roles} />;
}
