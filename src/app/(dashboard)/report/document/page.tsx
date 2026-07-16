import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { documentT, usersT, roleMasterT } from "@/db/schema";
import { buttonClasses } from "@/components/ui/button";
import DocumentList from "./document-list";

// Documents — list of saved print documents with CRUD (create / edit / delete).
export default async function DocumentPage() {
  const rows = await db
    .select({
      id: documentT.id,
      title: documentT.title,
      doc_type: documentT.doc_type,
      doc_date: documentT.doc_date,
      created_at: documentT.created_at,
      created_by_name: usersT.full_name,
      role_name: roleMasterT.role_name,
      signed_by_name: documentT.submitted_name,
    })
    .from(documentT)
    .leftJoin(usersT, eq(documentT.created_by, usersT.id))
    .leftJoin(roleMasterT, eq(usersT.role_id, roleMasterT.id))
    .where(eq(documentT.display, "Y"))
    .orderBy(desc(documentT.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Link href="/report/document/new" className={buttonClasses({ size: "sm" })}>
          <Plus className="h-4 w-4" /> New Document
        </Link>
      </div>
      <DocumentList rows={rows} />
    </div>
  );
}
