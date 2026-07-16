import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { stockTransactionT, stockBookT } from "@/db/schema";

// Supported single-book transaction types. TRANSFER is intentionally out of
// scope here (it is a two-book operation) — see the stock module notes.
const TYPES = new Set(["RECEIPT", "ISSUE", "ADJUSTMENT"]);

type Body = {
  id?: number;
  stock_book_id?: string | number;
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

/** Shared validation + coercion for create / update. */
function parse(body: Body) {
  const bookId = Number(body.stock_book_id);
  const type = String(body.transaction_type ?? "").trim().toUpperCase();
  const date = String(body.transaction_date ?? "").trim();
  const qty = Number(body.qty);

  if (!Number.isInteger(bookId) || bookId <= 0) return { error: "Select a stock book" };
  if (!TYPES.has(type)) return { error: "Choose a valid transaction type" };
  if (!date) return { error: "Transaction date is required" };
  if (Number.isNaN(qty) || qty === 0) return { error: "Enter a non-zero quantity" };
  if (type !== "ADJUSTMENT" && qty < 0) return { error: "Quantity must be positive" };

  const { receipt, issue } = splitQty(type, qty);
  return {
    bookId,
    values: {
      stock_book_id: bookId,
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
      const [row] = await tx
        .insert(stockTransactionT)
        .values({
          ...parsed.values,
          institution_id: 1,
          department_id: 1,
          stock_entry_type: "MANUAL",
          balance_qty: 0, // recompute() fills the real figure below
          created_by: session.id,
          display: "Y",
        })
        .returning({ id: stockTransactionT.id });
      await recompute(tx, parsed.bookId);
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

      await tx
        .update(stockTransactionT)
        .set({ ...parsed.values, updated_by: session.id, updated_at: new Date() })
        .where(eq(stockTransactionT.id, id));

      // Recompute the destination book and, if it moved, the source book too.
      await recompute(tx, parsed.bookId);
      if (existing.stock_book_id !== parsed.bookId) await recompute(tx, existing.stock_book_id);
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
