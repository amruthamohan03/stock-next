import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentRemarkT, documentT, usersT } from "@/db/schema";
import { toDocStatus } from "@/lib/document-status";
import { getSession } from "@/lib/session";
import { getSignatories } from "@/lib/signatories";
import { getKfcFormOptions } from "@/lib/kfc-forms";
import DocumentBuilder, { type DocumentInitial } from "../../document-builder";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const docId = Number(id);
  if (!docId) notFound();

  const [session, signatories, kfcForms, rows, remarkRows] = await Promise.all([
    getSession(),
    getSignatories(),
    getKfcFormOptions(),
    db
      .select()
      .from(documentT)
      .where(and(eq(documentT.id, docId), eq(documentT.display, "Y")))
      .limit(1),
    db
      .select({
        id: documentRemarkT.id,
        remark: documentRemarkT.remark,
        remark_date: documentRemarkT.remark_date,
        author: usersT.full_name,
      })
      .from(documentRemarkT)
      .leftJoin(usersT, eq(usersT.id, documentRemarkT.created_by))
      .where(and(eq(documentRemarkT.document_id, docId), eq(documentRemarkT.display, "Y")))
      .orderBy(asc(documentRemarkT.id)),
  ]);

  const doc = rows[0];
  if (!doc) notFound();

  const initial: DocumentInitial = {
    id: doc.id,
    title: s(doc.title),
    doc_type: doc.doc_type ?? "custom",
    body: s(doc.body),
    place: s(doc.place),
    doc_date: s(doc.doc_date),
    submitted_name: s(doc.submitted_name),
    designation: s(doc.designation),
    department: s(doc.department),
    institution: s(doc.institution),
    signed_by: s(doc.signed_by),
    attachment_name: doc.attachment_name ?? null,
    attachment_type: doc.attachment_type ?? null,
    status: toDocStatus(doc.status),
    remarks: remarkRows.map((r) => ({
      id: r.id,
      remark: r.remark,
      remark_date: r.remark_date ?? null,
      author: r.author ?? null,
    })),
  };

  return (
    <DocumentBuilder
      defaultName={session?.fullName ?? ""}
      defaultDesignation={session?.roleName ?? ""}
      signatories={signatories}
      kfcForms={kfcForms}
      initial={initial}
      isSuperAdmin={session?.roleId === 1}
    />
  );
}
