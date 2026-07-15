import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { indentMasterT } from "@/db/schema";

// Bills are stored privately (outside /public) and streamed via GET below,
// so they are only reachable by an authenticated session.
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "indent");
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = /^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/;

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

  if (!id) return NextResponse.json({ success: false, message: "Indent id is required" }, { status: 400 });
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
  if (!ALLOWED.test(file.type))
    return NextResponse.json({ success: false, message: "Only images or PDF files are allowed" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ success: false, message: "File is larger than 10 MB" }, { status: 400 });

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const ext = (path.extname(file.name) || "").toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
    const filename = `indent-${id}-${Date.now()}${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, filename), bytes);

    // Remove the previous bill file (if any) after the new one is written.
    const prev = await billOf(id);
    if (prev?.bill_path) await removeFile(prev.bill_path);

    await db
      .update(indentMasterT)
      .set({ bill_path: filename, bill_name: file.name, bill_type: file.type })
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
  if (!id) return NextResponse.json({ success: false, message: "Indent id is required" }, { status: 400 });

  const bill = await billOf(id);
  if (!bill?.bill_path) return NextResponse.json({ success: false, message: "No bill found" }, { status: 404 });

  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, path.basename(bill.bill_path)));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": bill.bill_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${bill.bill_name ?? "bill"}"`,
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
  if (!id) return NextResponse.json({ success: false, message: "Indent id is required" }, { status: 400 });

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
