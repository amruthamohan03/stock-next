import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { documentRemarkT, documentT } from "@/db/schema";
import { canEdit } from "@/lib/document-status";

// Dated remarks against a document — append a remark, or soft-delete one.
// A submitted document is locked, so its remark trail is frozen with it.

/** Refuse the write when the parent document is submitted and locked. */
async function assertUnlocked(documentId: number, roleId: number) {
  const [doc] = await db
    .select({ status: documentT.status })
    .from(documentT)
    .where(eq(documentT.id, documentId));
  if (!doc) {
    return NextResponse.json({ success: false, message: "Document not found" }, { status: 404 });
  }
  if (!canEdit(doc.status, roleId)) {
    return NextResponse.json(
      {
        success: false,
        message: "This document is submitted and locked. Only a Super Admin can change it.",
      },
      { status: 403 }
    );
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { document_id?: number; remark?: string; remark_date?: string };
  const documentId = Number(body.document_id);
  const remark = String(body.remark ?? "").trim();
  const remarkDate = String(body.remark_date ?? "").trim() || null;

  if (!documentId) {
    return NextResponse.json({ success: false, message: "Document id is required" }, { status: 400 });
  }
  if (!remark) {
    return NextResponse.json({ success: false, message: "Remark is required" }, { status: 400 });
  }

  const locked = await assertUnlocked(documentId, session.roleId);
  if (locked) return locked;

  try {
    const [row] = await db
      .insert(documentRemarkT)
      .values({
        document_id: documentId,
        remark,
        remark_date: remarkDate,
        created_by: session.id,
        display: "Y",
      })
      .returning({ id: documentRemarkT.id });
    return NextResponse.json({ success: true, message: "Remark added", id: row.id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ success: false, message: "Remark id is required" }, { status: 400 });

  const [remark] = await db
    .select({ document_id: documentRemarkT.document_id })
    .from(documentRemarkT)
    .where(eq(documentRemarkT.id, id));
  if (!remark) {
    return NextResponse.json({ success: false, message: "Remark not found" }, { status: 404 });
  }

  const locked = await assertUnlocked(remark.document_id, session.roleId);
  if (locked) return locked;

  try {
    // Soft delete, matching the masters — the trail is kept for history.
    await db
      .update(documentRemarkT)
      .set({ display: "N" })
      .where(and(eq(documentRemarkT.id, id), eq(documentRemarkT.display, "Y")));
    return NextResponse.json({ success: true, message: "Remark removed" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
