import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import { kfcForm21T, kfcForm21ItemT } from "@/db/schema";

// K.F.C. Form 21 — Survey Report of Stores. One form (header) → many article rows.
type ItemPayload = {
  item_id?: string | number | null;
  quantity?: string | number;
  description?: string;
  book_rate?: string | number;
  book_amount?: string | number;
  assessed_value?: string | number;
  date_of_receipt?: string;
  cause_remarks?: string;
  authority_remarks?: string;
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
// Money columns are numeric → store a normalized string (e.g. "1200.00").
const money = (v: unknown) => (numOrNull(v) ?? 0).toFixed(2);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;

/** Keep only rows the user actually filled (item picked, description, or a value). */
function cleanItems(items: ItemPayload[]) {
  return items.filter(
    (it) => numOrNull(it.item_id) !== null || str(it.description) || numOrNull(it.quantity)
  );
}

function rowValues(formId: number, it: ItemPayload, i: number) {
  return {
    form_id: formId,
    sl_no: i + 1,
    item_id: numOrNull(it.item_id),
    quantity: int0(it.quantity),
    description: str(it.description),
    book_rate: money(it.book_rate),
    book_amount: money(it.book_amount),
    assessed_value: money(it.assessed_value),
    date_of_receipt: str(it.date_of_receipt),
    cause_remarks: str(it.cause_remarks),
    authority_remarks: str(it.authority_remarks),
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
        .insert(kfcForm21T)
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
        .returning({ id: kfcForm21T.id });

      await tx.insert(kfcForm21ItemT).values(items.map((it, i) => rowValues(form.id, it, i)));
      return form.id;
    });

    return NextResponse.json({ success: true, message: "KFC Form 21 saved", id });
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
        .update(kfcForm21T)
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
        .where(eq(kfcForm21T.id, id));

      // Replace the article rows with the submitted set.
      await tx.delete(kfcForm21ItemT).where(eq(kfcForm21ItemT.form_id, id));
      await tx.insert(kfcForm21ItemT).values(items.map((it, i) => rowValues(id, it, i)));
    });

    return NextResponse.json({ success: true, message: "KFC Form 21 updated", id });
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
      await tx.update(kfcForm21T).set({ display: "N" }).where(eq(kfcForm21T.id, id));
      await tx.update(kfcForm21ItemT).set({ display: "N" }).where(eq(kfcForm21ItemT.form_id, id));
    });
    return NextResponse.json({ success: true, message: "KFC Form 21 deleted" });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
