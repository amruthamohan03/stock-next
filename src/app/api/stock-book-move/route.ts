import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import {
  linesFor,
  moveIndentLine,
  moveStockEntry,
  undoMove,
  type MoveSource,
} from "@/lib/stock-book-move";
import { indentMasterT, stockBookMasterT, stockBookMoveT, usersT } from "@/db/schema";

const fail = (message: string, status = 400) =>
  NextResponse.json({ success: false, message }, { status });

const sourceOf = (v: unknown): MoveSource | null =>
  v === "INDENT" || v === "STOCK" ? v : null;

const posInt = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Indent ids from "1,2,3" or [1, 2, 3]; null if any entry isn't a valid id. */
const idList = (v: unknown): number[] | null => {
  const raw = Array.isArray(v) ? v : String(v ?? "").split(",").filter((x) => x.trim() !== "");
  const ids = raw.map(posInt);
  return ids.some((id) => id === null) ? null : [...new Set(ids as number[])];
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Your session has expired. Please sign in again.", 401);

  const params = new URL(req.url).searchParams;
  const source = sourceOf(params.get("source"));
  const indentIds = idList(params.get("indent_ids"));
  if (!source) return fail("Choose whether to move indent items or stock entries.");
  if (!indentIds?.length) return fail("Choose at least one indent.");

  const lines = await linesFor(source, indentIds);
  return NextResponse.json({ success: true, message: "", data: lines });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Your session has expired. Please sign in again.", 401);

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    source?: string;
    indent_ids?: unknown;
    to_book_id?: unknown;
    to_page_no?: unknown;
    moved_date?: string;
    moved_by?: unknown;
    remarks?: string;
    lines?: { id?: unknown; qty?: unknown }[];
  };

  // REMOVE takes the lines out of their stock book: no target book or page.
  const removing = body.action === "REMOVE";
  const source = sourceOf(body.source);
  const indentIds = idList(body.indent_ids);
  const toBook = removing ? null : posInt(body.to_book_id);
  const toPage =
    removing || body.to_page_no === "" || body.to_page_no == null ? null : posInt(body.to_page_no);
  const verb = removing ? "remove" : "move";
  const movedDate = String(body.moved_date ?? "").trim();
  const movedBy = posInt(body.moved_by);

  if (!source) return fail("Choose whether to move indent items or stock entries.");
  if (!indentIds?.length) return fail("Choose at least one indent.");
  if (!removing && !toBook) return fail("Choose the stock book to move to.");
  if (!removing && body.to_page_no !== "" && body.to_page_no != null && !toPage)
    return fail("Page No must be a whole number above zero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(movedDate)) return fail(`Enter the date of the ${verb}.`);
  if (!movedBy) return fail(`Choose who did the ${verb}.`);

  const picked = (body.lines ?? []).map((l) => ({ id: posInt(l.id), qty: posInt(l.qty) }));
  if (picked.length === 0) return fail(`Tick at least one item to ${verb}.`);
  if (picked.some((l) => !l.id || !l.qty)) return fail("Each ticked item needs a quantity above zero.");

  const [indents, [book], [user], lines] = await Promise.all([
    db
      .select({ id: indentMasterT.id })
      .from(indentMasterT)
      .where(and(inArray(indentMasterT.id, indentIds), eq(indentMasterT.display, "Y"))),
    toBook
      ? db
          .select({ id: stockBookMasterT.id })
          .from(stockBookMasterT)
          .where(and(eq(stockBookMasterT.id, toBook), eq(stockBookMasterT.display, "Y")))
      : Promise.resolve([{ id: 0 }]),
    db.select({ id: usersT.id }).from(usersT).where(eq(usersT.id, movedBy)),
    linesFor(source, indentIds),
  ]);
  if (indents.length !== indentIds.length)
    return fail("One of the chosen indents no longer exists. Reload and try again.", 404);
  if (!book) return fail("That stock book no longer exists.", 404);
  if (!user) return fail("The user chosen in Moved By no longer exists.", 404);

  const byId = new Map(lines.map((l) => [l.id, l]));
  for (const p of picked) {
    const line = byId.get(p.id!);
    if (!line) return fail("One of the ticked items is no longer on these indents. Reload and try again.", 409);
    if (p.qty! > line.qty)
      return fail(`${line.item_name}: only ${line.qty} can be ${verb}d, not ${p.qty}.`);
    if (removing && line.book_id === null)
      return fail(`${line.item_name} is not entered in any stock book.`);
    if (!removing && line.book_id === toBook && line.page_no === toPage)
      return fail(`${line.item_name} is already on that page of that book.`);
  }

  try {
    await db.transaction(async (tx) => {
      for (const p of picked) {
        const line = byId.get(p.id!)!;
        const newId =
          source === "INDENT"
            ? await moveIndentLine(tx, line.id, p.qty!, toBook, toPage)
            : await moveStockEntry(tx, line.id, p.qty!, toBook, toPage, session.id);
        await tx.insert(stockBookMoveT).values({
          source_type: source,
          action: removing ? "REMOVE" : "MOVE",
          indent_id: line.indent_id,
          source_record_id: line.id,
          new_record_id: newId,
          item_id: line.item_id,
          qty_moved: p.qty!,
          from_stock_book_master_id: line.book_id,
          from_page_no: line.page_no,
          to_stock_book_master_id: toBook,
          to_page_no: toPage,
          moved_date: movedDate,
          moved_by: movedBy,
          remarks: body.remarks?.trim() || null,
          created_by: session.id,
        });
      }
    });
  } catch (e) {
    console.error("stock-book-move failed", e);
    return fail(`The ${verb} could not be saved. Nothing was changed; please try again.`, 500);
  }

  const count = picked.length;
  return NextResponse.json({
    success: true,
    message: removing
      ? `Removed ${count} ${count === 1 ? "item" : "items"} from the stock book.`
      : `Moved ${count} ${count === 1 ? "item" : "items"} to the new stock book.`,
  });
}

/** Edit a move's record-keeping details. The books it moved between stay as they were. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Your session has expired. Please sign in again.", 401);

  const body = (await req.json().catch(() => ({}))) as {
    id?: unknown;
    moved_date?: string;
    moved_by?: unknown;
    remarks?: string;
  };
  const id = posInt(body.id);
  const movedDate = String(body.moved_date ?? "").trim();
  const movedBy = posInt(body.moved_by);
  if (!id) return fail("Choose a record to edit.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(movedDate)) return fail("Enter the date.");
  if (!movedBy) return fail("Choose who did it.");

  const [[rec], [user]] = await Promise.all([
    db
      .select({ id: stockBookMoveT.id })
      .from(stockBookMoveT)
      .where(and(eq(stockBookMoveT.id, id), eq(stockBookMoveT.display, "Y"))),
    db.select({ id: usersT.id }).from(usersT).where(eq(usersT.id, movedBy)),
  ]);
  if (!rec) return fail("That record no longer exists.", 404);
  if (!user) return fail("The user chosen no longer exists.", 404);

  await db
    .update(stockBookMoveT)
    .set({ moved_date: movedDate, moved_by: movedBy, remarks: body.remarks?.trim() || null })
    .where(eq(stockBookMoveT.id, id));
  return NextResponse.json({ success: true, message: "Record updated." });
}

/**
 * Delete a move or removal by undoing it: the item goes back to the book and
 * page it came from, then the record is soft-deleted. Refused when a later
 * move touched the same line, or the line changed since — undo those first.
 */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Your session has expired. Please sign in again.", 401);

  const id = posInt(new URL(req.url).searchParams.get("id"));
  if (!id) return fail("Choose a record to delete.");

  const [rec] = await db
    .select()
    .from(stockBookMoveT)
    .where(and(eq(stockBookMoveT.id, id), eq(stockBookMoveT.display, "Y")));
  if (!rec) return fail("That record no longer exists.", 404);

  // Lines this record left behind: the original, and the split-off copy if any.
  const touched = [rec.source_record_id, ...(rec.new_record_id ? [rec.new_record_id] : [])];
  const [later] = await db
    .select({ id: stockBookMoveT.id })
    .from(stockBookMoveT)
    .where(
      and(
        eq(stockBookMoveT.display, "Y"),
        eq(stockBookMoveT.source_type, rec.source_type),
        gt(stockBookMoveT.id, rec.id),
        or(
          inArray(stockBookMoveT.source_record_id, touched),
          inArray(stockBookMoveT.new_record_id, touched)
        )
      )
    )
    .limit(1);
  if (later)
    return fail("This item was moved again later. Delete the later record first, then this one.", 409);

  try {
    const problem = await db.transaction(async (tx) => {
      const reason = await undoMove(tx, rec);
      if (reason) return reason;
      await tx.update(stockBookMoveT).set({ display: "N" }).where(eq(stockBookMoveT.id, rec.id));
      return null;
    });
    if (problem) return fail(problem, 409);
  } catch (e) {
    console.error("stock-book-move undo failed", e);
    return fail("The record could not be deleted. Nothing was changed; please try again.", 500);
  }
  return NextResponse.json({
    success: true,
    message:
      rec.action === "REMOVE"
        ? "Record deleted. The item is back in its stock book."
        : "Record deleted. The item is back in its original stock book.",
  });
}
