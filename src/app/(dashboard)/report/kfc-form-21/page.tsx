import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { FileText, Plus } from "lucide-react";
import { db } from "@/db";
import { kfcForm21T, kfcForm21ItemT, usersT, roleMasterT } from "@/db/schema";
import { buttonClasses } from "@/components/ui/button";
import Kfc21List from "./kfc21-list";

// K.F.C. Form 21 — Survey Report of Stores. List of saved forms with CRUD.
export default async function KfcForm21Page() {
  const rows = await db
    .select({
      id: kfcForm21T.id,
      title: kfcForm21T.title,
      form_date: kfcForm21T.form_date,
      created_at: kfcForm21T.created_at,
      created_by_name: usersT.full_name,
      role_name: roleMasterT.role_name,
      signed_by_name: kfcForm21T.signatory_name,
      item_count: sql<number>`count(${kfcForm21ItemT.id})::int`,
    })
    .from(kfcForm21T)
    .leftJoin(
      kfcForm21ItemT,
      and(eq(kfcForm21ItemT.form_id, kfcForm21T.id), eq(kfcForm21ItemT.display, "Y"))
    )
    .leftJoin(usersT, eq(kfcForm21T.created_by, usersT.id))
    .leftJoin(roleMasterT, eq(usersT.role_id, roleMasterT.id))
    .where(eq(kfcForm21T.display, "Y"))
    .groupBy(
      kfcForm21T.id,
      kfcForm21T.title,
      kfcForm21T.form_date,
      kfcForm21T.created_at,
      kfcForm21T.signatory_name,
      usersT.full_name,
      roleMasterT.role_name
    )
    .orderBy(desc(kfcForm21T.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/report/kfc-form-13"
          className={buttonClasses({ variant: "outline", size: "sm" })}
        >
          <FileText className="h-4 w-4" /> KFC Form 13
        </Link>
        <Link href="/report/kfc-form-21/new" className={buttonClasses({ size: "sm" })}>
          <Plus className="h-4 w-4" /> New KFC Form 21
        </Link>
      </div>
      <Kfc21List rows={rows} />
    </div>
  );
}
