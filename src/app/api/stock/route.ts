import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { stockTransactionT, stockBookT, issuedToMasterT } from "@/db/schema";

// Supported single-book transaction types. TRANSFER is intentionally out of
// scope here (it is a two-book operation) — see the stock module notes.
const TYPES = new Set(["RECEIPT", "ISSUE", "ADJUSTMENT"]);

type Body = {
  id?: number;
  stock_book_id?: string | number;
  new_location_id?: string | number;
  stock_book_master_id?: string | number;
  stock_book_page_no?: string | number;
  department_id?: string | number;
  issued_to_location_id?: string | number;
  no_indent_entry?: string;
  indent_id?: string | number;
  source?: string;
  transaction_type?: string;
  transaction_date?: string;
  qty?: string | number;
  voucher_no?: string;
  voucher_date?: string;
  item_status?: string;
  make?: string;
  model?: string;
  serial_no?: string;
  description?: string;
  remarks?: string;
};

const str = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
const dateOrNull = (v: unknown) => str(v);

/**
 * Split a signed quantity into (receipt, issue) columns based on the type.
 * RECEIPT adds, ISSUE removes, ADJUSTMENT can do either via a signed number.
 */
function splitQty(type: string, qty: number): { receipt: number; issue: number } {
  if (type === "RECEIPT") return { receipt: Math.abs(qty), issue: 0 };
  if (type === "ISSUE") return { receipt: 0, issue: Math.abs(qty) };
  // ADJUSTMENT: positive tops up, negative draws down.
  return qty >= 0 ? { receipt: qty, issue: 0 } : { receipt: 0, issue: -qty };
}

/**
 * Recompute the running balance for every visible transaction of a stock book
 * (ordered by date, then id) and store the final figure on the stock book.
 * Called after any create / edit / delete so the ledger stays consistent.
 */
async function recompute(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  bookId: number
) {
  const rows = await tx
    .select({
      id: stockTransactionT.id,
      receipt_qty: stockTransactionT.receipt_qty,
      issue_qty: stockTransactionT.issue_qty,
    })
    .from(stockTransactionT)
    .where(and(eq(stockTransactionT.stock_book_id, bookId), eq(stockTransactionT.display, "Y")))
    .orderBy(asc(stockTransactionT.transaction_date), asc(stockTransactionT.id));

  let running = 0;
  for (const r of rows) {
    running += (r.receipt_qty ?? 0) - (r.issue_qty ?? 0);
    await tx
      .update(stockTransactionT)
      .set({ balance_qty: running })
      .where(eq(stockTransactionT.id, r.id));
  }

  await tx
    .update(stockBookT)
    .set({ current_balance: running, updated_at: new Date() })
    .where(eq(stockBookT.id, bookId));
}

/**
 * The ledger row for an item at a location, created if this is the first entry
 * for it. An item only ever gets one row per location, so a second entry for
 * the same pair reuses it rather than splitting the running balance in two.
 */
async function ledgerRowFor(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  itemId: number,
  locationId: number,
  userId: number
) {
  const [location] = await tx
    .select({ id: issuedToMasterT.id, name: issuedToMasterT.location_name })
    .from(issuedToMasterT)
    .where(eq(issuedToMasterT.id, locationId))
    .limit(1);
  if (!location) throw new Error("That location is not in the Location master");

  const [existing] = await tx
    .select({ id: stockBookT.id })
    .from(stockBookT)
    .where(
      and(
        eq(stockBookT.item_id, itemId),
        eq(stockBookT.location_id, locationId),
        eq(stockBookT.display, "Y")
      )
    )
    .limit(1);
  if (existing) return existing.id;

  const [created] = await tx
    .insert(stockBookT)
    .values({
      item_id: itemId,
      location: location.name,
      location_id: locationId,
      opening_balance: 0,
      current_balance: 0,
      created_by: userId,
      display: "Y",
    })
    .returning({ id: stockBookT.id });
  return created.id;
}

/** Shared validation + coercion for create / update. */
function parse(body: Body) {
  // "book:3" is an existing ledger row, "item:109" an item whose ledger row has
  // to be opened first. A bare number is still accepted for older callers.
  const raw = String(body.stock_book_id ?? "").trim();
  const asItem = /^item:(\d+)$/.exec(raw);
  const bookId = asItem ? 0 : Number(raw.replace(/^book:/, ""));
  const newItemId = asItem ? Number(asItem[1]) : 0;
  const newLocationId = Number(body.new_location_id);
  const departmentId = Number(body.department_id);
  // Optional: the register master may be empty, and older entries predate it.
  const registerId = Number(body.stock_book_master_id);
  const pageNo = Number(body.stock_book_page_no);
  // Optional, and only set on issues; cleared otherwise so a type change does
  // not leave a stale destination behind.
  const issuedTo = Number(body.issued_to_location_id);
  const noIndent = body.no_indent_entry === "Y";
  const indentId = Number(body.indent_id);
  const hasIndent = !noIndent && Number.isInteger(indentId) && indentId > 0;

  // "dept:3" / "loc:15" / "stock" — anything else is treated as no source.
  const src = String(body.source ?? "").trim();
  const srcMatch = /^(dept|loc):(\d+)$/.exec(src);
  const srcId = srcMatch ? Number(srcMatch[2]) : 0;
  const sourceType =
    src === "stock" ? "STOCK" : srcMatch?.[1] === "dept" ? "DEPARTMENT" : srcMatch?.[1] === "loc" ? "LOCATION" : null;
  const type = String(body.transaction_type ?? "").trim().toUpperCase();
  const date = String(body.transaction_date ?? "").trim();
  const qty = Number(body.qty);

  if (!newItemId && (!Number.isInteger(bookId) || bookId <= 0)) return { error: "Select an item" };
  if (newItemId && (!Number.isInteger(newLocationId) || newLocationId <= 0))
    return { error: "Choose where this item is kept — it has no stock book yet" };
  if (!Number.isInteger(departmentId) || departmentId <= 0) return { error: "Select a department" };
  if (!TYPES.has(type)) return { error: "Choose a valid transaction type" };
  if (!date) return { error: "Transaction date is required" };
  if (Number.isNaN(qty) || qty === 0) return { error: "Enter a non-zero quantity" };
  if (type !== "ADJUSTMENT" && qty < 0) return { error: "Quantity must be positive" };

  const { receipt, issue } = splitQty(type, qty);
  return {
    bookId,
    newItemId,
    newLocationId,
    values: {
      stock_book_master_id: Number.isInteger(registerId) && registerId > 0 ? registerId : null,
      stock_book_page_no: Number.isInteger(pageNo) && pageNo > 0 ? pageNo : null,
      issued_to_location_id:
        type === "ISSUE" && Number.isInteger(issuedTo) && issuedTo > 0 ? issuedTo : null,
      no_indent_entry: noIndent ? "Y" : "N",
      indent_id: hasIndent ? indentId : null,
      // The entry type follows the indent link rather than being set by hand.
      stock_entry_type: hasIndent ? "INDENT_BASED" : "MANUAL",
      source_type: sourceType,
      transferred_from_department_id: sourceType === "DEPARTMENT" ? srcId : null,
      transferred_from_location_id: sourceType === "LOCATION" ? srcId : null,
      department_id: departmentId,
      transaction_type: type,
      transaction_date: date,
      receipt_qty: receipt,
      issue_qty: issue,
      voucher_no: str(body.voucher_no),
      voucher_date: dateOrNull(body.voucher_date),
      item_status: str(body.item_status) ?? "WORKING",
      make: str(body.make),
      model: str(body.model),
      serial_no: str(body.serial_no),
      description: str(body.description),
      remarks: str(body.remarks),
    },
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const parsed = parse((await req.json()) as Body);
  if ("error" in parsed) return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });

  try {
    const id = await db.transaction(async (tx) => {
      const bookId = parsed.newItemId
        ? await ledgerRowFor(tx, parsed.newItemId, parsed.newLocationId, session.id)
        : parsed.bookId;
      const [row] = await tx
        .insert(stockTransactionT)
        .values({
          ...parsed.values,
          stock_book_id: bookId,
          institution_id: 1,
          balance_qty: 0, // recompute() fills the real figure below
          created_by: session.id,
          display: "Y",
        })
        .returning({ id: stockTransactionT.id });
      await recompute(tx, bookId);
      return row.id;
    });
    return NextResponse.json({ success: true, message: "Stock transaction saved", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "A valid transaction id is required" }, { status: 400 });

  const parsed = parse(body);
  if ("error" in parsed) return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ stock_book_id: stockTransactionT.stock_book_id })
        .from(stockTransactionT)
        .where(and(eq(stockTransactionT.id, id), eq(stockTransactionT.display, "Y")))
        .limit(1);
      if (!existing) throw new Error("Transaction not found");

      const bookId = parsed.newItemId
        ? await ledgerRowFor(tx, parsed.newItemId, parsed.newLocationId, session.id)
        : parsed.bookId;

      await tx
        .update(stockTransactionT)
        .set({
          ...parsed.values,
          stock_book_id: bookId,
          updated_by: session.id,
          updated_at: new Date(),
        })
        .where(eq(stockTransactionT.id, id));

      // Recompute the destination book and, if it moved, the source book too.
      await recompute(tx, bookId);
      if (existing.stock_book_id !== bookId) await recompute(tx, existing.stock_book_id);
    });
    return NextResponse.json({ success: true, message: "Stock transaction updated", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "A valid transaction id is required" }, { status: 400 });

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ stock_book_id: stockTransactionT.stock_book_id })
        .from(stockTransactionT)
        .where(eq(stockTransactionT.id, id))
        .limit(1);
      if (!existing) throw new Error("Transaction not found");

      await tx.update(stockTransactionT).set({ display: "N", updated_by: session.id, updated_at: new Date() }).where(eq(stockTransactionT.id, id));
      await recompute(tx, existing.stock_book_id);
    });
    return NextResponse.json({ success: true, message: "Stock transaction deleted" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
