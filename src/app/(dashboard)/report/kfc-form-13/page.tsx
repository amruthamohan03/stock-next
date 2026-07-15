import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { kfcForm13T, kfcForm13ItemT, usersT, roleMasterT } from "@/db/schema";
import { buttonClasses } from "@/components/ui/button";
import KfcList from "./kfc-list";

// K.F.C. Form 13 — list of saved forms with CRUD (create / edit / delete).
export default async function KfcForm13Page() {
  const rows = await db
    .select({
      id: kfcForm13T.id,
      title: kfcForm13T.title,
      form_date: kfcForm13T.form_date,
      created_at: kfcForm13T.created_at,
      created_by_name: usersT.full_name,
      role_name: roleMasterT.role_name,
      signed_by_name: kfcForm13T.signatory_name,
      item_count: sql<number>`count(${kfcForm13ItemT.id})::int`,
    })
    .from(kfcForm13T)
    .leftJoin(
      kfcForm13ItemT,
      and(eq(kfcForm13ItemT.form_id, kfcForm13T.id), eq(kfcForm13ItemT.display, "Y"))
    )
    .leftJoin(usersT, eq(kfcForm13T.created_by, usersT.id))
    .leftJoin(roleMasterT, eq(usersT.role_id, roleMasterT.id))
    .where(eq(kfcForm13T.display, "Y"))
    .groupBy(
      kfcForm13T.id,
      kfcForm13T.title,
      kfcForm13T.form_date,
      kfcForm13T.created_at,
      kfcForm13T.signatory_name,
      usersT.full_name,
      roleMasterT.role_name
    )
    .orderBy(desc(kfcForm13T.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Link href="/report/kfc-form-13/new" className={buttonClasses({ size: "sm" })}>
          <Plus className="h-4 w-4" /> New KFC Form 13
        </Link>
      </div>
      <KfcList rows={rows} />
    </div>
  );
}
