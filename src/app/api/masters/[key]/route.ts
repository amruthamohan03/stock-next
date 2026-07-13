import { NextResponse, type NextRequest } from "next/server";
import { and, eq, ne, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { MASTERS, type MasterConfig } from "@/lib/masters-config";
import { hashPassword } from "@/lib/password";

type Params = { params: Promise<{ key: string }> };

/** True if another row already holds `value` in `field` (optionally excluding one id). */
async function isDuplicate(
  cfg: MasterConfig,
  field: string,
  value: unknown,
  excludeId?: number
) {
  const col = (cfg.table as unknown as Record<string, unknown>)[field] as never;
  const idCol = (cfg.table as unknown as Record<string, unknown>).id as never;
  const where =
    excludeId != null ? and(eq(col, value as never), ne(idCol, excludeId as never)) : eq(col, value as never);
  const rows = await db.select({ id: idCol }).from(cfg.table).where(where).limit(1);
  return rows.length > 0;
}

function buildValues(cfg: MasterConfig, body: Record<string, unknown>) {
  const values: Record<string, unknown> = {};
  for (const field of cfg.writable) {
    if (!(field in body)) continue;
    const isNum = cfg.numeric?.includes(field) ?? false;
    const isHash = cfg.hash?.includes(field) ?? false;
    const v = body[field];

    // Hash fields: skip when blank so an empty value keeps the existing hash.
    if (isHash) {
      if (v === "" || v === undefined || v === null) continue;
      values[field] = String(v);
      continue;
    }

    if (v === "" || v === undefined) {
      values[field] = isNum ? 0 : null;
    } else {
      values[field] = isNum ? Number(v) : v;
    }
  }
  return values;
}

async function applyHashes(cfg: MasterConfig, values: Record<string, unknown>) {
  for (const field of cfg.hash ?? []) {
    const v = values[field];
    if (typeof v === "string" && v) values[field] = await hashPassword(v);
  }
}

/** Never return hashed columns (e.g. password) to the client. */
function stripHashes(cfg: MasterConfig, row: Record<string, unknown>) {
  if (!cfg.hash || !row) return row;
  const clone = { ...row };
  for (const field of cfg.hash) delete clone[field];
  return clone;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { key } = await params;
  const cfg = MASTERS[key];
  if (!cfg) return NextResponse.json({ success: false, message: "Unknown master" }, { status: 404 });

  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;

  for (const field of cfg.requiredOnInsert ?? []) {
    if (!String(body[field] ?? "").trim()) {
      return NextResponse.json(
        { success: false, message: `${field.replace(/_/g, " ")} is required` },
        { status: 400 }
      );
    }
  }

  const columns = getTableColumns(cfg.table) as Record<string, unknown>;
  const values = buildValues(cfg, body);

  if (Object.keys(values).length === 0) {
    return NextResponse.json({ success: false, message: "No valid fields provided" }, { status: 400 });
  }

  for (const field of cfg.unique ?? []) {
    if (field in values && (await isDuplicate(cfg, field, values[field]))) {
      return NextResponse.json(
        { success: false, message: `${field.replace(/_/g, " ")} already exists` },
        { status: 409 }
      );
    }
  }

  // audit + defaults, only for columns that exist on the table
  if ("created_by" in columns) values.created_by = session.id;
  if ("updated_by" in columns) values.updated_by = session.id;
  if ("display" in columns && !values.display) values.display = "Y";
  for (const [col, val] of Object.entries(cfg.insertDefaults ?? {})) {
    if (values[col] === undefined) values[col] = val;
  }

  await applyHashes(cfg, values);

  try {
    const inserted = await db
      .insert(cfg.table)
      .values(values as never)
      .returning();
    return NextResponse.json({
      success: true,
      message: "Saved successfully",
      data: stripHashes(cfg, inserted[0] as Record<string, unknown>),
    });
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
  const values = buildValues(cfg, body);

  for (const field of cfg.unique ?? []) {
    if (field in values && (await isDuplicate(cfg, field, values[field], id))) {
      return NextResponse.json(
        { success: false, message: `${field.replace(/_/g, " ")} already exists` },
        { status: 409 }
      );
    }
  }

  if ("updated_by" in columns) values.updated_by = session.id;
  if ("updated_at" in columns) values.updated_at = new Date();

  await applyHashes(cfg, values);

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
