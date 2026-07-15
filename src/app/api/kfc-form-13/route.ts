import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { kfcForm13T, kfcForm13ItemT } from "@/db/schema";

// K.F.C. Form 13 — save a form (header) with its article rows. One form → many rows.
type ItemPayload = {
  item_id?: string | number | null;
  article?: string;
  stock_on_hand?: string | number;
  purchase_year?: string | number;
  qty_required?: string | number;
  rate_unit?: string | number;
  rate_amount?: string | number;
  supplier?: string;
  purpose?: string;
  delivery_place?: string;
  classification_no?: string;
  remarks?: string;
};

type Body = {
  id?: number;
  title?: string;
  form_date?: string;
  department_id?: string | number | null;
  signed_by?: string | number | null;
  signatory_name?: string;
  signatory_designation?: string;
  items?: ItemPayload[];
};

const numOrNull = (v: unknown) => {
  const n = Number(v);
  return v === "" || v === undefined || v === null || Number.isNaN(n) ? null : n;
};
const int0 = (v: unknown) => numOrNull(v) ?? 0;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;

/** Keep only rows the user actually filled in (an item picked or article typed). */
function cleanItems(items: ItemPayload[]) {
  return items.filter((it) => numOrNull(it.item_id) !== null || str(it.article));
}

function rowValues(formId: number, it: ItemPayload, i: number) {
  return {
    form_id: formId,
    sl_no: i + 1,
    item_id: numOrNull(it.item_id),
    article: str(it.article),
    stock_on_hand: int0(it.stock_on_hand),
    purchase_year: int0(it.purchase_year),
    qty_required: int0(it.qty_required),
    rate_unit: int0(it.rate_unit),
    rate_amount: int0(it.rate_amount),
    supplier: str(it.supplier),
    purpose: str(it.purpose),
    delivery_place: str(it.delivery_place),
    classification_no: str(it.classification_no),
    remarks: str(it.remarks),
    display: "Y",
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ success: false, message: "Title is required" }, { status: 400 });

  const items = cleanItems(body.items ?? []);
  if (items.length === 0)
    return NextResponse.json({ success: false, message: "Add at least one article row" }, { status: 400 });

  try {
    const id = await db.transaction(async (tx) => {
      const [form] = await tx
        .insert(kfcForm13T)
        .values({
          title,
          form_date: str(body.form_date),
          department_id: numOrNull(body.department_id),
          signed_by: numOrNull(body.signed_by),
          signatory_name: str(body.signatory_name),
          signatory_designation: str(body.signatory_designation),
          created_by: session.id,
          display: "Y",
        })
        .returning({ id: kfcForm13T.id });

      await tx.insert(kfcForm13ItemT).values(items.map((it, i) => rowValues(form.id, it, i)));
      return form.id;
    });

    return NextResponse.json({ success: true, message: "KFC Form 13 saved", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const id = Number(body.id);
  const title = String(body.title ?? "").trim();
  if (!id) return NextResponse.json({ success: false, message: "Form id is required" }, { status: 400 });
  if (!title) return NextResponse.json({ success: false, message: "Title is required" }, { status: 400 });

  const items = cleanItems(body.items ?? []);
  if (items.length === 0)
    return NextResponse.json({ success: false, message: "Add at least one article row" }, { status: 400 });

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(kfcForm13T)
        .set({
          title,
          form_date: str(body.form_date),
          department_id: numOrNull(body.department_id),
          signed_by: numOrNull(body.signed_by),
          signatory_name: str(body.signatory_name),
          signatory_designation: str(body.signatory_designation),
          updated_by: session.id,
          updated_at: new Date(),
        })
        .where(eq(kfcForm13T.id, id));

      // Replace the article rows with the submitted set.
      await tx.delete(kfcForm13ItemT).where(eq(kfcForm13ItemT.form_id, id));
      await tx.insert(kfcForm13ItemT).values(items.map((it, i) => rowValues(id, it, i)));
    });

    return NextResponse.json({ success: true, message: "KFC Form 13 updated", id });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ success: false, message: "Form id is required" }, { status: 400 });

  try {
    await db.transaction(async (tx) => {
      await tx.update(kfcForm13T).set({ display: "N" }).where(eq(kfcForm13T.id, id));
      await tx.update(kfcForm13ItemT).set({ display: "N" }).where(eq(kfcForm13ItemT.form_id, id));
    });
    return NextResponse.json({ success: true, message: "KFC Form 13 deleted" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
