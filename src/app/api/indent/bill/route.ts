import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { indentMasterT } from "@/db/schema";

// Bills are stored privately (outside /public) and streamed via GET below,
// so they are only reachable by an authenticated session.
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "indent");
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Canonical MIME → extension for the formats we accept. The MIME type is
// decided by sniffing the file's own bytes (below), never by the client's
// claimed `file.type`, which is spoofable.
const EXT_FOR: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

/**
 * Determine the real content type from the file's magic bytes. Returns one of
 * the accepted MIME types, or null if the content isn't a real image/PDF —
 * this is what stops a script/HTML file disguised with an `image/png` type.
 */
function sniffType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "image/png";
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // GIF: "GIF87a" / "GIF89a"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38)
    return "image/gif";
  // WebP: "RIFF"...."WEBP"
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  // PDF: "%PDF-" (may be preceded by a small amount of whitespace/BOM)
  if (buf.toString("ascii", 0, 8).replace(/^[\s﻿]+/, "").startsWith("%PDF-"))
    return "application/pdf";
  return null;
}

/** Strip anything that could break/inject an HTTP header, keep a safe filename. */
function safeFilename(name: string | null | undefined): string {
  const cleaned = (name ?? "").replace(/[\r\n"\\]/g, "").replace(/[\x00-\x1f]/g, "").trim();
  return cleaned.slice(0, 200) || "bill";
}

async function billOf(id: number) {
  const [row] = await db
    .select({
      bill_path: indentMasterT.bill_path,
      bill_name: indentMasterT.bill_name,
      bill_type: indentMasterT.bill_type,
    })
    .from(indentMasterT)
    .where(eq(indentMasterT.id, id))
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

// Upload / replace the bill for an indent.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const id = Number(form.get("id"));
  const file = form.get("file");

  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "A valid indent id is required" }, { status: 400 });
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ success: false, message: "File is larger than 10 MB" }, { status: 400 });

  // The indent must exist and not be soft-deleted before we attach anything.
  const [indent] = await db
    .select({ id: indentMasterT.id })
    .from(indentMasterT)
    .where(and(eq(indentMasterT.id, id), eq(indentMasterT.display, "Y")))
    .limit(1);
  if (!indent)
    return NextResponse.json({ success: false, message: "Indent not found" }, { status: 404 });

  // Read the bytes and decide the type from the content itself, not from the
  // browser-supplied `file.type` (which can be forged). Anything that isn't a
  // real image/PDF is rejected here.
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_BYTES)
    return NextResponse.json({ success: false, message: "File is larger than 10 MB" }, { status: 400 });
  const type = sniffType(bytes);
  if (!type)
    return NextResponse.json(
      { success: false, message: "Only genuine image (PNG, JPEG, GIF, WebP) or PDF files are allowed" },
      { status: 400 }
    );

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Extension comes from the verified type, so the stored file can never
    // carry an executable/other extension regardless of the original name.
    const filename = `indent-${id}-${Date.now()}${EXT_FOR[type]}`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), new Uint8Array(bytes));

    // Remove the previous bill file (if any) after the new one is written.
    const prev = await billOf(id);
    if (prev?.bill_path) await removeFile(prev.bill_path);

    await db
      .update(indentMasterT)
      .set({ bill_path: filename, bill_name: safeFilename(file.name), bill_type: type })
      .where(eq(indentMasterT.id, id));

    return NextResponse.json({ success: true, message: "Bill uploaded" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

// Stream the bill inline (image/pdf) for an authenticated user.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "A valid indent id is required" }, { status: 400 });

  const bill = await billOf(id);
  if (!bill?.bill_path) return NextResponse.json({ success: false, message: "No bill found" }, { status: 404 });

  try {
    // basename() guards against any path traversal in the stored value.
    const data = await fs.readFile(path.join(UPLOAD_DIR, path.basename(bill.bill_path)));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": bill.bill_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeFilename(bill.bill_name)}"`,
        // Never let the browser second-guess the declared type.
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Bill file missing on server" }, { status: 404 });
  }
}

// Remove the bill from an indent.
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "A valid indent id is required" }, { status: 400 });

  try {
    const bill = await billOf(id);
    await removeFile(bill?.bill_path);
    await db
      .update(indentMasterT)
      .set({ bill_path: null, bill_name: null, bill_type: null })
      .where(eq(indentMasterT.id, id));
    return NextResponse.json({ success: true, message: "Bill removed" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
