import { NextResponse, type NextRequest } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { indentMasterT, indentItemT } from "@/db/schema";

// Create a new indent (header + line items) — ports the PHP IndentController save.
type ItemPayload = {
  stock_book_master_id?: string | number;
  group_id?: string | number;
  item_id?: string | number;
  make_id?: string | number;
  model_id?: string | number;
  description?: string;
  purpose?: string;
  qty?: string | number;
  remarks?: string;
  sb_page?: string | number;
  sb_vol?: string | number;
  db_page?: string | number;
  db_vol?: string | number;
};

const numOrNull = (v: unknown) => {
  const n = Number(v);
  return v === "" || v === undefined || v === null || Number.isNaN(n) ? null : n;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    book_no?: string | number;
    department_id?: string | number;
    no_stock_entry?: string;
    indent_no?: string;
    item_type?: string;
    indent_date?: string;
    purpose?: string;
    items?: ItemPayload[];
  };

  const bookNo = Number(body.book_no);
  const departmentId = Number(body.department_id);
  const noStockEntry = body.no_stock_entry === "Y" ? "Y" : "N";
  const indentNo = String(body.indent_no ?? "").trim();
  const itemType = body.item_type === "C" ? "C" : "N";
  const indentDate = String(body.indent_date ?? "").trim();

  if (!bookNo) return NextResponse.json({ success: false, message: "Book No is required" }, { status: 400 });
  if (!departmentId)
    return NextResponse.json({ success: false, message: "Department is required" }, { status: 400 });
  if (!indentNo) return NextResponse.json({ success: false, message: "Indent No is required" }, { status: 400 });
  if (!indentDate) return NextResponse.json({ success: false, message: "Date is required" }, { status: 400 });

  // Keep only rows that have an item selected and a quantity.
  const items = (body.items ?? []).filter((it) => it.item_id && Number(it.qty) > 0);
  if (items.length === 0)
    return NextResponse.json(
      { success: false, message: "Add at least one item with a quantity" },
      { status: 400 }
    );

  try {
    const id = await db.transaction(async (tx) => {
      const [indent] = await tx
        .insert(indentMasterT)
        .values({
          book_no: bookNo,
          indent_no: indentNo,
          item_type: itemType,
          indent_date: indentDate,
          purpose: body.purpose?.trim() || null,
          department_id: departmentId,
          no_stock_entry: noStockEntry,
          institution_id: 1,
          created_by: session.id,
          status: "CREATED",
          display: "Y",
        })
        .returning({ id: indentMasterT.id });

      await tx.insert(indentItemT).values(
        items.map((it, i) => ({
          indent_id: indent.id,
          sl_no: i + 1,
          item_id: Number(it.item_id),
          group_id: numOrNull(it.group_id),
          make_id: numOrNull(it.make_id),
          model_id: numOrNull(it.model_id),
          item_description: it.description?.trim() || null,
          item_purpose: it.purpose?.trim() || null,
          qty_intended: Number(it.qty) || 0,
          remarks: it.remarks?.trim() || null,
          stock_book_master_id: numOrNull(it.stock_book_master_id),
          stock_book_page_no: numOrNull(it.sb_page),
          stock_book_volume: numOrNull(it.sb_vol),
          day_book_page_no: numOrNull(it.db_page),
          day_book_volume: numOrNull(it.db_vol),
          display: "Y",
          status_id: 1,
        }))
      );

      return indent.id;
    });

    return NextResponse.json({ success: true, message: "Indent saved successfully", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

// Update an existing indent (header + replace its line items).
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    id?: number;
    book_no?: string | number;
    department_id?: string | number;
    no_stock_entry?: string;
    indent_no?: string;
    item_type?: string;
    indent_date?: string;
    purpose?: string;
    items?: ItemPayload[];
  };

  const id = Number(body.id);
  const bookNo = Number(body.book_no);
  const departmentId = Number(body.department_id);
  const noStockEntry = body.no_stock_entry === "Y" ? "Y" : "N";
  const indentNo = String(body.indent_no ?? "").trim();
  const itemType = body.item_type === "C" ? "C" : "N";
  const indentDate = String(body.indent_date ?? "").trim();

  if (!id) return NextResponse.json({ success: false, message: "Indent id is required" }, { status: 400 });
  if (!bookNo) return NextResponse.json({ success: false, message: "Book No is required" }, { status: 400 });
  if (!departmentId)
    return NextResponse.json({ success: false, message: "Department is required" }, { status: 400 });
  if (!indentNo) return NextResponse.json({ success: false, message: "Indent No is required" }, { status: 400 });
  if (!indentDate) return NextResponse.json({ success: false, message: "Date is required" }, { status: 400 });

  const items = (body.items ?? []).filter((it) => it.item_id && Number(it.qty) > 0);
  if (items.length === 0)
    return NextResponse.json(
      { success: false, message: "Add at least one item with a quantity" },
      { status: 400 }
    );

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(indentMasterT)
        .set({
          book_no: bookNo,
          indent_no: indentNo,
          item_type: itemType,
          indent_date: indentDate,
          purpose: body.purpose?.trim() || null,
          department_id: departmentId,
          no_stock_entry: noStockEntry,
          updated_at: new Date(),
        })
        .where(eq(indentMasterT.id, id));

      // The form only edits the intended quantity, so the passed and issued
      // figures have to survive the replace below — they are the record of
      // what the store actually handed over, and re-inserting without them
      // silently reset them to zero.
      const previous = await tx
        .select({
          item_id: indentItemT.item_id,
          qty_passed: indentItemT.qty_passed,
          qty_issued: indentItemT.qty_issued,
        })
        .from(indentItemT)
        .where(eq(indentItemT.indent_id, id))
        .orderBy(asc(indentItemT.sl_no));

      // Matched by item, oldest row first, so reordering or removing a line
      // does not shuffle one line's figures onto another.
      const carried = new Map<number, { qty_passed: number; qty_issued: number }[]>();
      for (const row of previous) {
        const list = carried.get(row.item_id) ?? [];
        list.push({ qty_passed: row.qty_passed ?? 0, qty_issued: row.qty_issued ?? 0 });
        carried.set(row.item_id, list);
      }
      const carryFor = (itemId: number) => carried.get(itemId)?.shift() ?? { qty_passed: 0, qty_issued: 0 };

      // Replace line items with the submitted set.
      await tx.delete(indentItemT).where(eq(indentItemT.indent_id, id));
      await tx.insert(indentItemT).values(
        items.map((it, i) => {
          const itemId = Number(it.item_id);
          const kept = carryFor(itemId);
          return {
          indent_id: id,
          sl_no: i + 1,
          item_id: itemId,
          group_id: numOrNull(it.group_id),
          make_id: numOrNull(it.make_id),
          model_id: numOrNull(it.model_id),
          item_description: it.description?.trim() || null,
          item_purpose: it.purpose?.trim() || null,
          qty_intended: Number(it.qty) || 0,
          qty_passed: kept.qty_passed,
          qty_issued: kept.qty_issued,
          remarks: it.remarks?.trim() || null,
          stock_book_master_id: numOrNull(it.stock_book_master_id),
          stock_book_page_no: numOrNull(it.sb_page),
          stock_book_volume: numOrNull(it.sb_vol),
          day_book_page_no: numOrNull(it.db_page),
          day_book_volume: numOrNull(it.db_vol),
          display: "Y",
          status_id: 1,
          };
        })
      );
    });

    return NextResponse.json({ success: true, message: "Indent updated successfully", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

// Soft-delete an indent (header + its line items) — matches the app's soft-delete convention.
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ success: false, message: "Indent id is required" }, { status: 400 });

  try {
    await db.transaction(async (tx) => {
      await tx.update(indentMasterT).set({ display: "N" }).where(eq(indentMasterT.id, id));
      await tx.update(indentItemT).set({ display: "N" }).where(eq(indentItemT.indent_id, id));
    });
    return NextResponse.json({ success: true, message: "Indent deleted" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
