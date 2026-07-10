import { NextResponse, type NextRequest } from "next/server";
import { eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { MASTERS } from "@/lib/masters-config";

type Params = { params: Promise<{ key: string }> };

function buildValues(key: string, body: Record<string, unknown>) {
  const cfg = MASTERS[key];
  const values: Record<string, unknown> = {};
  for (const field of cfg.writable) {
    if (!(field in body)) continue;
    const isNum = cfg.numeric?.includes(field) ?? false;
    let v = body[field];
    if (v === "" || v === undefined) {
      v = isNum ? 0 : null;
    } else if (isNum) {
      v = Number(v);
    }
    values[field] = v;
  }
  return values;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { key } = await params;
  const cfg = MASTERS[key];
  if (!cfg) return NextResponse.json({ success: false, message: "Unknown master" }, { status: 404 });

  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const columns = getTableColumns(cfg.table) as Record<string, unknown>;
  const values = buildValues(key, body);

  if (Object.keys(values).length === 0) {
    return NextResponse.json({ success: false, message: "No valid fields provided" }, { status: 400 });
  }

  // audit + defaults, only for columns that exist on the table
  if ("created_by" in columns) values.created_by = session.id;
  if ("updated_by" in columns) values.updated_by = session.id;
  if ("display" in columns && !values.display) values.display = "Y";

  try {
    const inserted = await db
      .insert(cfg.table)
      .values(values as never)
      .returning();
    return NextResponse.json({ success: true, message: "Saved successfully", data: inserted[0] });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { key } = await params;
  const cfg = MASTERS[key];
  if (!cfg) return NextResponse.json({ success: false, message: "Unknown master" }, { status: 404 });

  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, message: "Invalid id" }, { status: 400 });

  const columns = getTableColumns(cfg.table) as Record<string, unknown>;
  const values = buildValues(key, body);
  if ("updated_by" in columns) values.updated_by = session.id;
  if ("updated_at" in columns) values.updated_at = new Date();

  try {
    const idCol = (cfg.table as unknown as Record<string, unknown>).id as never;
    await db.update(cfg.table).set(values as never).where(eq(idCol, id));
    return NextResponse.json({ success: true, message: "Updated successfully" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { key } = await params;
  const cfg = MASTERS[key];
  if (!cfg) return NextResponse.json({ success: false, message: "Unknown master" }, { status: 404 });

  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ success: false, message: "Invalid id" }, { status: 400 });

  const columns = getTableColumns(cfg.table) as Record<string, unknown>;
  const idCol = (cfg.table as unknown as Record<string, unknown>).id as never;

  try {
    // Soft-delete when a `display` flag exists (keeps history); hard-delete otherwise.
    if ("display" in columns) {
      await db.update(cfg.table).set({ display: "N" } as never).where(eq(idCol, id));
    } else {
      await db.delete(cfg.table).where(eq(idCol, id));
    }
    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
