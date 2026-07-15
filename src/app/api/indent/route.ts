import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { indentMasterT, indentItemT } from "@/db/schema";

// Create a new indent (header + line items) — ports the PHP IndentController save.
type ItemPayload = {
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
    indent_no?: string;
    item_type?: string;
    indent_date?: string;
    purpose?: string;
    items?: ItemPayload[];
  };

  const bookNo = Number(body.book_no);
  const indentNo = String(body.indent_no ?? "").trim();
  const itemType = body.item_type === "C" ? "C" : "N";
  const indentDate = String(body.indent_date ?? "").trim();

  if (!bookNo) return NextResponse.json({ success: false, message: "Book No is required" }, { status: 400 });
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
          department_id: 1,
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
    indent_no?: string;
    item_type?: string;
    indent_date?: string;
    purpose?: string;
    items?: ItemPayload[];
  };

  const id = Number(body.id);
  const bookNo = Number(body.book_no);
  const indentNo = String(body.indent_no ?? "").trim();
  const itemType = body.item_type === "C" ? "C" : "N";
  const indentDate = String(body.indent_date ?? "").trim();

  if (!id) return NextResponse.json({ success: false, message: "Indent id is required" }, { status: 400 });
  if (!bookNo) return NextResponse.json({ success: false, message: "Book No is required" }, { status: 400 });
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
          updated_at: new Date(),
        })
        .where(eq(indentMasterT.id, id));

      // Replace line items with the submitted set.
      await tx.delete(indentItemT).where(eq(indentItemT.indent_id, id));
      await tx.insert(indentItemT).values(
        items.map((it, i) => ({
          indent_id: id,
          sl_no: i + 1,
          item_id: Number(it.item_id),
          group_id: numOrNull(it.group_id),
          make_id: numOrNull(it.make_id),
          model_id: numOrNull(it.model_id),
          item_description: it.description?.trim() || null,
          item_purpose: it.purpose?.trim() || null,
          qty_intended: Number(it.qty) || 0,
          remarks: it.remarks?.trim() || null,
          stock_book_page_no: numOrNull(it.sb_page),
          stock_book_volume: numOrNull(it.sb_vol),
          day_book_page_no: numOrNull(it.db_page),
          day_book_volume: numOrNull(it.db_vol),
          display: "Y",
          status_id: 1,
        }))
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
