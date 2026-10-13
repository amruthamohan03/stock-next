import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, Pencil, Paperclip } from "lucide-react";
import { db } from "@/db";
import { documentRemarkT, documentT, usersT } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { isLocked, statusLabel, toDocStatus } from "@/lib/document-status";
import { formatDate } from "@/lib/utils";
import PrintButton from "../../_components/print-button";
import DocumentSheetStyle from "../document-sheet-style";
import AutoPrint from "../auto-print";

const TYPE_LABEL: Record<string, string> = {
  submission: "Submission",
  justification: "Justification",
  essentiality: "Essentiality",
  custom: "Custom",
};

/**
 * Read-only view of a composed document — the printable sheet plus its remark
 * trail. Editing lives at `[id]/edit`; this page never mutates anything, so it
 * is the safe place to land from the list once a document is final.
 */
export default async function DocumentViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const [{ id }, { print }] = await Promise.all([params, searchParams]);
  const docId = Number(id);
  if (!Number.isInteger(docId) || docId <= 0) notFound();

  const [rows, remarks] = await Promise.all([
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

  const status = toDocStatus(doc.status);
  const locked = isLocked(status);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-fg">{doc.title}</h1>
          <StatusBadge status={status} label={statusLabel(status)} />
          <span className="text-sm text-muted">
            {doc.doc_type ? TYPE_LABEL[doc.doc_type] ?? doc.doc_type : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/report/document" className={buttonClasses({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          {/* A final document is read-only, so there is nothing to edit into. */}
          {!locked && (
            <Link
              href={`/report/document/${doc.id}/edit`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          )}
          <PrintButton />
        </div>
      </div>

      {/* The sheet — same markup and print rules as the builder's preview. */}
      <div className="printable doc-sheet mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-10 shadow-sm">
        <div className="mb-6 text-center text-xl font-bold tracking-wide text-[#1f4e79]">
          {doc.title}
        </div>

        {/*
          The body is rich text composed in this app's own editor by signed-in
          staff — the same content the builder loads straight into the editable
          div. Rendered as HTML so the printed page matches the composer.
        */}
        <div
          className="doc-body min-h-[240px]"
          dangerouslySetInnerHTML={{ __html: doc.body ?? "" }}
        />

        <div className="mt-16 flex items-end justify-between gap-6 text-sm">
          <div className="space-y-1">
            <div className="text-slate-800">{doc.place || " "}</div>
            <div className="text-slate-800">{doc.doc_date ? formatDate(doc.doc_date) : " "}</div>
          </div>
          <div className="space-y-1 text-right text-slate-800">
            <div className="font-medium">{doc.submitted_name || " "}</div>
            <div>{doc.designation}</div>
            <div>{doc.department}</div>
            <div>{doc.institution}</div>
          </div>
        </div>
      </div>

      {doc.attachment_name && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Attachment</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={`/api/document/attachment?id=${doc.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
            >
              <Paperclip className="h-4 w-4" />
              {doc.attachment_name}
            </a>
          </CardContent>
        </Card>
      )}

      {/* Remarks — read-only here; they are added from the edit page. */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Remarks</CardTitle>
        </CardHeader>
        <CardContent>
          {remarks.length === 0 ? (
            <p className="text-sm text-muted">No remarks were added.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {remarks.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                  <span className="w-24 shrink-0 tabular-nums text-muted">
                    {r.remark_date ? formatDate(r.remark_date) : "—"}
                  </span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-fg">
                    {r.remark}
                  </span>
                  {r.author && <span className="shrink-0 text-xs text-faint">{r.author}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DocumentSheetStyle />
      {/* Arrived here from the list's Print action — open the dialog straight away. */}
      {print === "1" && <AutoPrint />}
    </div>
  );
}
