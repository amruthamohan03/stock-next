import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentT } from "@/db/schema";
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

  const [session, signatories, kfcForms, rows] = await Promise.all([
    getSession(),
    getSignatories(),
    getKfcFormOptions(),
    db
      .select()
      .from(documentT)
      .where(and(eq(documentT.id, docId), eq(documentT.display, "Y")))
      .limit(1),
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
  };

  return (
    <DocumentBuilder
      defaultName={session?.fullName ?? ""}
      defaultDesignation={session?.roleName ?? ""}
      signatories={signatories}
      kfcForms={kfcForms}
      initial={initial}
    />
  );
}
