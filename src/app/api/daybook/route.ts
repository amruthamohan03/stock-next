import { NextResponse, type NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { daybookMasterT, daybookItemT } from "@/db/schema";

// Ports DaybookController (K.F.C. Form 16 — Day Book of Stores).
// One master document → many RECEIPT and ISSUE item lines.
type LinePayload = {
  item_id?: string | number | null;
  item_description?: string;
  unit_id?: string | number | null;
  issued_to_id?: string | number | null;
  receipt_qty_number?: string | number;
  receipt_qty_weight?: string | number;
  issue_qty_number?: string | number;
  issue_qty_weight?: string | number;
  receipt_rate?: string | number;
  receipt_amount_rs?: string | number;
  receipt_amount_ps?: string | number;
  issue_rate?: string | number;
  issue_amount_rs?: string | number;
  issue_amount_ps?: string | number;
  balance_rate?: string | number;
  balance_amount_ps?: string | number;
  value_verifier?: string;
  indent_no?: string;
  indent_date?: string;
};

type Body = {
  id?: number;
  page_no?: string;
  stockbook_type_id?: string | number;
  class?: string;
  unit_label?: string;
  receipt_order_no?: string;
  document_date?: string;
  service_provider_id?: string | number;
  invoice_ref?: string;
  invoice_date?: string;
  issued_to_id?: string | number | null;
  cr_voucher_ref?: string;
  verifier_id?: string | number | null;
  remarks?: string;
  receipt_items?: LinePayload[];
  issue_items?: LinePayload[];
};

const numOrNull = (v: unknown) => {
  const n = Number(v);
  return v === "" || v === undefined || v === null || Number.isNaN(n) ? null : n;
};
const n0 = (v: unknown) => numOrNull(v) ?? 0;
/** numeric columns are stored as strings by the driver. */
const dec = (v: unknown) => String(n0(v));
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;

const hasItem = (l: LinePayload) => (numOrNull(l.item_id) ?? 0) > 0;

/** Build a daybook_item_t row. Balances are derived server-side. */
function lineValues(
  daybookId: number,
  slNo: number,
  type: "RECEIPT" | "ISSUE",
  l: LinePayload
) {
  const rQtyN = n0(l.receipt_qty_number);
  const rQtyW = n0(l.receipt_qty_weight);
  const iQtyN = n0(l.issue_qty_number);
  const iQtyW = n0(l.issue_qty_weight);
  const rAmt = n0(l.receipt_amount_rs);
  const iAmt = n0(l.issue_amount_rs);

  return {
    daybook_id: daybookId,
    sl_no: slNo,
    transaction_type: type,
    item_id: n0(l.item_id),
    item_description: String(l.item_description ?? "").trim(),
    unit_id: numOrNull(l.unit_id),
    issued_to_id: numOrNull(l.issued_to_id),
    receipt_qty_number: dec(rQtyN),
    receipt_qty_weight: dec(rQtyW),
    issue_qty_number: dec(iQtyN),
    issue_qty_weight: dec(iQtyW),
    balance_qty_number: dec(rQtyN - iQtyN),
    balance_qty_weight: dec(rQtyW - iQtyW),
    receipt_rate: dec(l.receipt_rate),
    receipt_amount_rs: dec(rAmt),
    receipt_amount_ps: dec(l.receipt_amount_ps),
    issue_rate: dec(l.issue_rate),
    issue_amount_rs: dec(iAmt),
    issue_amount_ps: dec(l.issue_amount_ps),
    balance_rate: dec(l.balance_rate),
    balance_amount_rs: dec(rAmt - iAmt),
    balance_amount_ps: dec(l.balance_amount_ps),
    value_verifier: str(l.value_verifier),
    // Indent details only apply to ISSUE lines.
    indent_no: type === "ISSUE" ? str(l.indent_no) : null,
    indent_date: type === "ISSUE" ? str(l.indent_date) : null,
    display: "Y",
  };
}

/** Shared validation for create/update. */
function validate(body: Body) {
  const pageNo = String(body.page_no ?? "").trim();
  const typeId = n0(body.stockbook_type_id);
  const docDate = String(body.document_date ?? "").trim();
  const providerId = n0(body.service_provider_id);

  if (!pageNo) return { error: "Page number is required" };
  if (typeId <= 0) return { error: "Please select a stockbook type" };
  if (!docDate) return { error: "Document date is required" };
  if (providerId <= 0) return { error: "Please select a service provider" };

  const receipts = (body.receipt_items ?? []).filter(hasItem);
  const issues = (body.issue_items ?? []).filter(hasItem);
  if (receipts.length === 0) return { error: "Please add at least one receipt item line" };

  return { pageNo, typeId, docDate, providerId, receipts, issues };
}

function masterValues(body: Body, v: { pageNo: string; typeId: number; docDate: string; providerId: number }) {
  return {
    page_no: v.pageNo,
    stockbook_type_id: v.typeId,
    class: str(body.class),
    unit_label: str(body.unit_label),
    receipt_order_no: str(body.receipt_order_no),
    document_date: v.docDate,
    service_provider_id: v.providerId,
    invoice_ref: str(body.invoice_ref),
    invoice_date: str(body.invoice_date),
    issued_to_id: numOrNull(body.issued_to_id),
    cr_voucher_ref: str(body.cr_voucher_ref),
    verifier_id: numOrNull(body.verifier_id),
    remarks: str(body.remarks),
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const v = validate(body);
  if ("error" in v) return NextResponse.json({ success: false, message: v.error }, { status: 400 });

  // One entry per provider + date (mirrors the PHP uniqueness rule).
  const dup = await db
    .select({ id: daybookMasterT.id })
    .from(daybookMasterT)
    .where(
      and(
        eq(daybookMasterT.service_provider_id, v.providerId),
        eq(daybookMasterT.document_date, v.docDate),
        eq(daybookMasterT.display, "Y")
      )
    )
    .limit(1);
  if (dup.length)
    return NextResponse.json(
      { success: false, message: "An entry already exists for this provider on this date. Please edit the existing entry." },
      { status: 400 }
    );

  try {
    const id = await db.transaction(async (tx) => {
      const [master] = await tx
        .insert(daybookMasterT)
        .values({
          ...masterValues(body, v),
          created_by: session.id,
          status: "ACTIVE",
          display: "Y",
        })
        .returning({ id: daybookMasterT.id });

      const lines = [
        ...v.receipts.map((l, i) => lineValues(master.id, i + 1, "RECEIPT", l)),
        ...v.issues.map((l, i) => lineValues(master.id, i + 1, "ISSUE", l)),
      ];
      if (lines.length) await tx.insert(daybookItemT).values(lines);
      return master.id;
    });

    return NextResponse.json({ success: true, message: "Day Book entry created successfully", id });
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
    return NextResponse.json({ success: false, message: "Invalid Day Book ID" }, { status: 400 });

  const v = validate(body);
  if ("error" in v) return NextResponse.json({ success: false, message: v.error }, { status: 400 });

  // Uniqueness, excluding this record.
  const dup = await db
    .select({ id: daybookMasterT.id })
    .from(daybookMasterT)
    .where(
      and(
        eq(daybookMasterT.service_provider_id, v.providerId),
        eq(daybookMasterT.document_date, v.docDate),
        ne(daybookMasterT.id, id),
        eq(daybookMasterT.display, "Y")
      )
    )
    .limit(1);
  if (dup.length)
    return NextResponse.json(
      { success: false, message: "Another entry already exists for this provider on this date." },
      { status: 400 }
    );

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(daybookMasterT)
        .set({ ...masterValues(body, v), updated_at: new Date() })
        .where(eq(daybookMasterT.id, id));

      // Replace the lines with the submitted set.
      await tx.delete(daybookItemT).where(eq(daybookItemT.daybook_id, id));
      const lines = [
        ...v.receipts.map((l, i) => lineValues(id, i + 1, "RECEIPT", l)),
        ...v.issues.map((l, i) => lineValues(id, i + 1, "ISSUE", l)),
      ];
      if (lines.length) await tx.insert(daybookItemT).values(lines);
    });

    return NextResponse.json({ success: true, message: "Day Book entry updated successfully", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ success: false, message: "Invalid Day Book ID" }, { status: 400 });

  try {
    // Soft delete, consistent with the rest of the app.
    await db.transaction(async (tx) => {
      await tx.update(daybookItemT).set({ display: "N" }).where(eq(daybookItemT.daybook_id, id));
      await tx.update(daybookMasterT).set({ display: "N" }).where(eq(daybookMasterT.id, id));
    });
    return NextResponse.json({ success: true, message: "Day Book entry deleted successfully" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
