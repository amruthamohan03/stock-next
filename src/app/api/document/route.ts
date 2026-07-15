import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { documentT } from "@/db/schema";

// Composed print documents — save / update / soft-delete.
type Body = {
  id?: number;
  title?: string;
  doc_type?: string;
  body?: string;
  place?: string;
  doc_date?: string;
  submitted_name?: string;
  designation?: string;
  department?: string;
  institution?: string;
  signed_by?: string | number | null;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;
const numOrNull = (v: unknown) => {
  const n = Number(v);
  return v === "" || v === undefined || v === null || Number.isNaN(n) ? null : n;
};

function values(body: Body) {
  return {
    title: String(body.title ?? "").trim(),
    doc_type: str(body.doc_type) ?? "custom",
    body: typeof body.body === "string" ? body.body : null,
    place: str(body.place),
    doc_date: str(body.doc_date),
    submitted_name: str(body.submitted_name),
    designation: str(body.designation),
    department: str(body.department),
    institution: str(body.institution),
    signed_by: numOrNull(body.signed_by),
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const v = values(body);
  if (!v.title) return NextResponse.json({ success: false, message: "Title is required" }, { status: 400 });

  try {
    const [row] = await db
      .insert(documentT)
      .values({ ...v, created_by: session.id, display: "Y" })
      .returning({ id: documentT.id });
    return NextResponse.json({ success: true, message: "Document saved", id: row.id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const id = Number(body.id);
  const v = values(body);
  if (!id) return NextResponse.json({ success: false, message: "Document id is required" }, { status: 400 });
  if (!v.title) return NextResponse.json({ success: false, message: "Title is required" }, { status: 400 });

  try {
    await db
      .update(documentT)
      .set({ ...v, updated_by: session.id, updated_at: new Date() })
      .where(eq(documentT.id, id));
    return NextResponse.json({ success: true, message: "Document updated", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ success: false, message: "Document id is required" }, { status: 400 });

  try {
    await db.update(documentT).set({ display: "N" }).where(eq(documentT.id, id));
    return NextResponse.json({ success: true, message: "Document deleted" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
