import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import {
  indentItemsOf,
  lineKey,
  moveIndentLine,
  moveLineToIndent,
  moveStockEntry,
  pageEntries,
  removeStockQty,
  resolveTargetIndent,
  undoMove,
  MoveRefused,
  type MoveLine,
} from "@/lib/stock-book-move";
import {
  indentBookT,
  indentMasterT,
  stockBookMasterT,
  stockBookMoveT,
  usersT,
} from "@/db/schema";

/**
 * Two ways in:
 * - INDENT: items of chosen indents (picked by indent book, then indent no /
 *   date). MOVE puts them on an indent in another indent book; REMOVE takes
 *   them out of their stock register.
 * - PAGE: everything on one page of a stock register — indent items written
 *   there and stock entries recorded there. MOVE re-enters them in another
 *   register/page; REMOVE takes them out of the stock book.
 */
type Mode = "INDENT" | "PAGE";

const fail = (message: string, status = 400) =>
  NextResponse.json({ success: false, message }, { status });

const modeOf = (v: unknown): Mode | null => (v === "INDENT" || v === "PAGE" ? v : null);

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

/** "0" (or empty) means the register's entries with no page number. */
const pageOf = (v: unknown): number | null | undefined => {
  if (v === "" || v === null || v === undefined || v === "0" || v === 0) return null;
  return posInt(v) ?? undefined;
};

const isoDate = (v: unknown) => {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** The lines a request may act on, or an error message. */
async function sourceLines(mode: Mode, args: { indent_ids?: unknown; book_id?: unknown; page?: unknown }) {
  if (mode === "INDENT") {
    const ids = idList(args.indent_ids);
    if (!ids?.length) return { error: "Choose at least one indent." } as const;
    return { lines: await indentItemsOf(ids), indentIds: ids } as const;
  }
  const bookId = posInt(args.book_id);
  const page = pageOf(args.page);
  if (!bookId) return { error: "Choose a stock book." } as const;
  if (page === undefined) return { error: "Choose a page number." } as const;
  return { lines: await pageEntries(bookId, page), indentIds: [] as number[] } as const;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Your session has expired. Please sign in again.", 401);

  const params = new URL(req.url).searchParams;
  const mode = modeOf(params.get("mode"));
  if (!mode) return fail("Choose indent entry or stock entry.");
  const src = await sourceLines(mode, {
    indent_ids: params.get("indent_ids"),
    book_id: params.get("book_id"),
    page: params.get("page"),
  });
  if ("error" in src) return fail(src.error!);
  return NextResponse.json({ success: true, message: "", data: src.lines });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Your session has expired. Please sign in again.", 401);

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    mode?: string;
    indent_ids?: unknown;
    book_id?: unknown;
    page?: unknown;
    to_book_id?: unknown;
    to_page_no?: unknown;
    to_indent_book?: unknown;
    to_indent_no?: unknown;
    to_indent_date?: unknown;
    moved_date?: string;
    moved_by?: unknown;
    remarks?: string;
    lines?: { kind?: unknown; id?: unknown; qty?: unknown }[];
  };

  const mode = modeOf(body.mode);
  const removing = body.action === "REMOVE";
  const verb = removing ? "remove" : "move";
  // Where a move goes: another indent (indent mode) or another register page.
  const toIndent = mode === "INDENT" && !removing;
  const toBook = !removing && mode === "PAGE" ? posInt(body.to_book_id) : null;
  const toPage =
    !removing && mode === "PAGE" && body.to_page_no !== "" && body.to_page_no != null
      ? posInt(body.to_page_no)
      : null;
  const target = toIndent
    ? {
        bookId: posInt(body.to_indent_book),
        indentNo: String(body.to_indent_no ?? "").trim(),
        indentDate: isoDate(body.to_indent_date),
      }
    : null;
  const movedDate = isoDate(body.moved_date);
  const movedBy = posInt(body.moved_by);

  if (!mode) return fail("Choose indent entry or stock entry.");
  if (target && !target.bookId) return fail("Choose the indent book to move to.");
  if (target && !target.indentNo) return fail("Enter the indent number to move to.");
  if (target && target.indentNo.length > 50) return fail("The indent number can be up to 50 characters.");
  if (target && !target.indentDate) return fail("Enter the date of the indent to move to.");
  if (mode === "PAGE" && !removing && !toBook) return fail("Choose the stock book to move to.");
  if (mode === "PAGE" && !removing && body.to_page_no !== "" && body.to_page_no != null && !toPage)
    return fail("Page No must be a whole number above zero.");
  if (!movedDate) return fail(`Enter the date of the ${verb}.`);
  if (!movedBy) return fail(`Choose who did the ${verb}.`);

  const picked = (body.lines ?? []).map((l) => ({
    key: `${l.kind}:${l.id}`,
    qty: posInt(l.qty),
  }));
  if (picked.length === 0) return fail(`Tick at least one item to ${verb}.`);
  if (picked.some((l) => !l.qty)) return fail("Each ticked item needs a quantity above zero.");

  const [src, [book], [indentBook], [user]] = await Promise.all([
    sourceLines(mode, body),
    toBook
      ? db
          .select({ id: stockBookMasterT.id })
          .from(stockBookMasterT)
          .where(and(eq(stockBookMasterT.id, toBook), eq(stockBookMasterT.display, "Y")))
      : Promise.resolve([{ id: 0 }]),
    target?.bookId
      ? db
          .select({ id: indentBookT.id })
          .from(indentBookT)
          .where(and(eq(indentBookT.id, target.bookId), eq(indentBookT.display, "Y")))
      : Promise.resolve([{ id: 0 }]),
    db.select({ id: usersT.id }).from(usersT).where(eq(usersT.id, movedBy)),
  ]);
  if ("error" in src) return fail(src.error!);
  if (!book) return fail("That stock book no longer exists.", 404);
  if (!indentBook) return fail("That indent book no longer exists.", 404);
  if (!user) return fail("The user chosen no longer exists.", 404);
  if (mode === "INDENT") {
    const live = await db
      .select({ id: indentMasterT.id })
      .from(indentMasterT)
      .where(and(inArray(indentMasterT.id, src.indentIds), eq(indentMasterT.display, "Y")));
    if (live.length !== src.indentIds.length)
      return fail("One of the chosen indents no longer exists. Reload and try again.", 404);
  }

  const byKey = new Map(src.lines.map((l) => [lineKey(l), l]));
  const chosen: { line: MoveLine; qty: number }[] = [];
  for (const p of picked) {
    const line = byKey.get(p.key);
    if (!line) return fail("One of the ticked items has changed since it was listed. Reload and try again.", 409);
    if (p.qty! > line.qty)
      return fail(`${line.item_name}: only ${line.qty} can be ${verb}d, not ${p.qty}.`);
    // An indent item is "in" a stock book only through its register; a stock
    // entry is always in the stock book, so it can be removed regardless.
    if (removing && line.kind === "INDENT" && line.book_id === null)
      return fail(`${line.item_name} is not entered in any stock book.`);
    if (toBook && line.book_id === toBook && line.page_no === toPage)
      return fail(`${line.item_name} is already on that page of that book.`);
    chosen.push({ line, qty: p.qty! });
  }

  try {
    await db.transaction(async (tx) => {
      // One target indent for the whole request, found or created once.
      let dest: { id: number; created: boolean } | null = null;
      for (const { line, qty } of chosen) {
        let newId: number | null = null;
        if (target) {
          dest ??= await resolveTargetIndent(
            tx,
            { bookId: target.bookId!, indentNo: target.indentNo, indentDate: target.indentDate! },
            line.indent_id!,
            session.id
          );
          if (dest.id === line.indent_id)
            throw new MoveRefused(`${line.item_name} is already on that indent.`);
          newId = await moveLineToIndent(tx, line.id, qty, dest.id);
        } else if (line.kind === "INDENT") {
          newId = await moveIndentLine(tx, line.id, qty, toBook, toPage);
        } else if (removing) {
          await removeStockQty(tx, line.id, qty, session.id);
        } else {
          newId = await moveStockEntry(tx, line.id, qty, toBook, toPage, session.id);
        }
        await tx.insert(stockBookMoveT).values({
          source_type: line.kind,
          action: removing ? "REMOVE" : "MOVE",
          indent_id: line.indent_id,
          source_record_id: line.id,
          new_record_id: newId,
          item_id: line.item_id,
          qty_moved: qty,
          from_stock_book_master_id: line.book_id,
          from_page_no: line.page_no,
          to_stock_book_master_id: toBook,
          to_page_no: toPage,
          to_indent_id: dest?.id ?? null,
          created_indent: dest?.created ? "Y" : "N",
          moved_date: movedDate,
          moved_by: movedBy,
          remarks: body.remarks?.trim() || null,
          created_by: session.id,
        });
      }
    });
  } catch (e) {
    // The transaction rolled back, so nothing was saved.
    if (e instanceof MoveRefused) return fail(e.message, 409);
    console.error("stock-book-move failed", e);
    return fail(`The ${verb} could not be saved. Nothing was changed; please try again.`, 500);
  }

  const n = `${chosen.length} ${chosen.length === 1 ? "item" : "items"}`;
  return NextResponse.json({
    success: true,
    message: removing
      ? `Removed ${n} from the stock book.`
      : target
        ? `Moved ${n} to indent ${target.indentNo}.`
        : `Moved ${n} to the new stock book.`,
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
        ? "Record deleted. The removal is undone."
        : rec.to_indent_id
          ? "Record deleted. The item is back on its original indent."
          : "Record deleted. The item is back in its original stock book.",
  });
}
