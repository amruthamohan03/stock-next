import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { attachmentT, committeeT, eventT } from "@/db/schema";
import { EXT_FOR, MAX_UPLOAD_BYTES, safeFilename, sniffType } from "@/lib/upload";
import { isOwnerType, toCategory, type OwnerType } from "@/lib/attachment";

/**
 * Files attached to a committee or an event.
 *
 * One route for both, and one POST can carry several files — the panel lets
 * people drop a whole folder of event photos in at once. Files are stored
 * outside /public and streamed through GET, so they are only reachable with an
 * authenticated session, and the content type is sniffed from the bytes rather
 * than trusting the browser.
 */
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "attachment");

/** The owning row must exist and not be soft-deleted. */
async function ownerExists(ownerType: OwnerType, ownerId: number) {
  if (ownerType === "COMMITTEE") {
    const [row] = await db
      .select({ id: committeeT.id })
      .from(committeeT)
      .where(and(eq(committeeT.id, ownerId), eq(committeeT.display, "Y")))
      .limit(1);
    return !!row;
  }
  const [row] = await db
    .select({ id: eventT.id })
    .from(eventT)
    .where(and(eq(eventT.id, ownerId), eq(eventT.display, "Y")))
    .limit(1);
  return !!row;
}

async function removeFile(name: string | null | undefined) {
  if (!name) return;
  try {
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(name)));
  } catch {
    /* already gone — ignore */
  }
}

/** Upload one or more files against an owner. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const ownerTypeRaw = String(form.get("owner_type") ?? "").toUpperCase();
  const ownerId = Number(form.get("owner_id"));
  const category = toCategory(form.get("category"));
  const title = String(form.get("title") ?? "").trim() || null;

  if (!isOwnerType(ownerTypeRaw))
    return NextResponse.json({ success: false, message: "Unknown owner type" }, { status: 400 });
  const ownerType = ownerTypeRaw as OwnerType;

  if (!Number.isInteger(ownerId) || ownerId <= 0)
    return NextResponse.json({ success: false, message: "A valid owner id is required" }, { status: 400 });

  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0)
    return NextResponse.json({ success: false, message: "No files provided" }, { status: 400 });

  if (!(await ownerExists(ownerType, ownerId)))
    return NextResponse.json(
      { success: false, message: `${ownerType === "EVENT" ? "Event" : "Committee"} not found` },
      { status: 404 }
    );

  const saved: string[] = [];
  const rejected: string[] = [];

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    for (const file of files) {
      const label = safeFilename(file.name);
      if (file.size > MAX_UPLOAD_BYTES) {
        rejected.push(`${label} (larger than 10 MB)`);
        continue;
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.length > MAX_UPLOAD_BYTES) {
        rejected.push(`${label} (larger than 10 MB)`);
        continue;
      }
      const type = sniffType(bytes);
      if (!type) {
        rejected.push(`${label} (not a genuine image or PDF)`);
        continue;
      }

      const filename = `${ownerType.toLowerCase()}-${ownerId}-${Date.now()}-${saved.length}${EXT_FOR[type]}`;
      await fs.writeFile(path.join(UPLOAD_DIR, filename), new Uint8Array(bytes));
      await db.insert(attachmentT).values({
        owner_type: ownerType,
        owner_id: ownerId,
        category,
        title,
        file_path: filename,
        file_name: label,
        file_type: type,
        file_size: bytes.length,
        uploaded_by: session.id,
        display: "Y",
      });
      saved.push(label);
    }
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }

  // A partial upload still succeeded for some files — say exactly which failed
  // rather than reporting a blanket error over a batch that mostly worked.
  if (saved.length === 0) {
    return NextResponse.json(
      { success: false, message: `Nothing uploaded — ${rejected.join("; ")}` },
      { status: 400 }
    );
  }
  const message =
    rejected.length === 0
      ? `${saved.length} file${saved.length === 1 ? "" : "s"} uploaded`
      : `${saved.length} uploaded, ${rejected.length} skipped — ${rejected.join("; ")}`;
  return NextResponse.json({ success: true, message, saved: saved.length, rejected: rejected.length });
}

/** Stream one attachment inline. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "A valid attachment id is required" }, { status: 400 });

  const [row] = await db
    .select()
    .from(attachmentT)
    .where(and(eq(attachmentT.id, id), eq(attachmentT.display, "Y")))
    .limit(1);
  if (!row) return NextResponse.json({ success: false, message: "Attachment not found" }, { status: 404 });

  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, path.basename(row.file_path)));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": row.file_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeFilename(row.file_name)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "File missing on server" }, { status: 404 });
  }
}

/** Rename or recategorise an attachment. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { id?: number; title?: string; category?: string };
  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, message: "Attachment id is required" }, { status: 400 });

  try {
    await db
      .update(attachmentT)
      .set({
        title: String(body.title ?? "").trim() || null,
        category: toCategory(body.category),
      })
      .where(eq(attachmentT.id, id));
    return NextResponse.json({ success: true, message: "File updated" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "A valid attachment id is required" }, { status: 400 });

  const [row] = await db.select().from(attachmentT).where(eq(attachmentT.id, id)).limit(1);
  if (!row) return NextResponse.json({ success: false, message: "Attachment not found" }, { status: 404 });

  try {
    // Hard delete here, unlike the masters: the row only points at a file, and
    // leaving orphaned bytes on disk is worse than losing the pointer.
    await removeFile(row.file_path);
    await db.delete(attachmentT).where(eq(attachmentT.id, id));
    return NextResponse.json({ success: true, message: "File removed" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
