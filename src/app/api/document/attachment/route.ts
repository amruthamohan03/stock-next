import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { documentT } from "@/db/schema";
import { canEdit } from "@/lib/document-status";

/**
 * The attachment is part of the document, so it freezes with it: refuse the
 * write when the document is submitted and locked.
 */
async function lockedResponse(id: number, roleId: number) {
  const [doc] = await db
    .select({ status: documentT.status })
    .from(documentT)
    .where(eq(documentT.id, id))
    .limit(1);
  if (doc && !canEdit(doc.status, roleId)) {
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
import { EXT_FOR, MAX_UPLOAD_BYTES, safeFilename, sniffType } from "@/lib/upload";

// Attachments are stored privately (outside /public) and streamed via GET,
// so they're only reachable by an authenticated session.
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "document");

async function attachmentOf(id: number) {
  const [row] = await db
    .select({
      attachment_path: documentT.attachment_path,
      attachment_name: documentT.attachment_name,
      attachment_type: documentT.attachment_type,
    })
    .from(documentT)
    .where(eq(documentT.id, id))
    .limit(1);
  return row;
}

async function removeFile(name: string | null | undefined) {
  if (!name) return;
  try {
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(name)));
  } catch {
    /* already gone — ignore */
  }
}

// Upload / replace the attachment for a document.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const id = Number(form.get("id"));
  const file = form.get("file");

  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "A valid document id is required" }, { status: 400 });
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES)
    return NextResponse.json({ success: false, message: "File is larger than 10 MB" }, { status: 400 });

  // The document must exist and not be soft-deleted.
  const [doc] = await db
    .select({ id: documentT.id })
    .from(documentT)
    .where(and(eq(documentT.id, id), eq(documentT.display, "Y")))
    .limit(1);
  if (!doc) return NextResponse.json({ success: false, message: "Document not found" }, { status: 404 });

  const locked = await lockedResponse(id, session.roleId);
  if (locked) return locked;

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_UPLOAD_BYTES)
    return NextResponse.json({ success: false, message: "File is larger than 10 MB" }, { status: 400 });
  const type = sniffType(bytes);
  if (!type)
    return NextResponse.json(
      { success: false, message: "Only genuine image (PNG, JPEG, GIF, WebP) or PDF files are allowed" },
      { status: 400 }
    );

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `document-${id}-${Date.now()}${EXT_FOR[type]}`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), new Uint8Array(bytes));

    const prev = await attachmentOf(id);
    if (prev?.attachment_path) await removeFile(prev.attachment_path);

    await db
      .update(documentT)
      .set({ attachment_path: filename, attachment_name: safeFilename(file.name), attachment_type: type })
      .where(eq(documentT.id, id));

    return NextResponse.json({ success: true, message: "Attachment uploaded" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

// Stream the attachment inline for an authenticated user.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "A valid document id is required" }, { status: 400 });

  const att = await attachmentOf(id);
  if (!att?.attachment_path) return NextResponse.json({ success: false, message: "No attachment found" }, { status: 404 });

  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, path.basename(att.attachment_path)));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": att.attachment_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeFilename(att.attachment_name)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Attachment file missing on server" }, { status: 404 });
  }
}

// Remove the attachment from a document.
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "A valid document id is required" }, { status: 400 });

  const locked = await lockedResponse(id, session.roleId);
  if (locked) return locked;

  try {
    const att = await attachmentOf(id);
    await removeFile(att?.attachment_path);
    await db
      .update(documentT)
      .set({ attachment_path: null, attachment_name: null, attachment_type: null })
      .where(eq(documentT.id, id));
    return NextResponse.json({ success: true, message: "Attachment removed" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
