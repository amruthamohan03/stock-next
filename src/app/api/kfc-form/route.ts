import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/session";
import {
  kfcForm13T,
  kfcForm13ItemT,
  kfcForm21T,
  kfcForm21ItemT,
  itemMasterT,
} from "@/db/schema";

// Read a saved KFC form's header + normalized item lines + total, so the
// Document builder can prefill a proposal from it. GET ?kind=form13|form21&id=
export type KfcLine = { sl: number; name: string; qty: number; rate: number; amount: number };

const num = (v: unknown) => Number(v ?? 0);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ success: false, message: "Form id is required" }, { status: 400 });

  try {
    if (kind === "form13") {
      const [header] = await db
        .select({ title: kfcForm13T.title, date: kfcForm13T.form_date })
        .from(kfcForm13T)
        .where(and(eq(kfcForm13T.id, id), eq(kfcForm13T.display, "Y")))
        .limit(1);
      if (!header) return NextResponse.json({ success: false, message: "Form not found" }, { status: 404 });

      const rows = await db
        .select({
          sl: kfcForm13ItemT.sl_no,
          article: kfcForm13ItemT.article,
          item_name: itemMasterT.item_name,
          qty: kfcForm13ItemT.qty_required,
          rate: kfcForm13ItemT.rate_unit,
          amount: kfcForm13ItemT.rate_amount,
        })
        .from(kfcForm13ItemT)
        .leftJoin(itemMasterT, eq(kfcForm13ItemT.item_id, itemMasterT.id))
        .where(and(eq(kfcForm13ItemT.form_id, id), eq(kfcForm13ItemT.display, "Y")))
        .orderBy(asc(kfcForm13ItemT.sl_no));

      const items: KfcLine[] = rows.map((r, i) => ({
        sl: r.sl ?? i + 1,
        name: (r.article || r.item_name || "").trim(),
        qty: num(r.qty),
        rate: num(r.rate),
        amount: num(r.amount),
      }));
      const total = items.reduce((s, r) => s + r.amount, 0);
      return NextResponse.json({ success: true, data: { title: header.title, date: header.date, items, total } });
    }

    if (kind === "form21") {
      const [header] = await db
        .select({ title: kfcForm21T.title, date: kfcForm21T.form_date })
        .from(kfcForm21T)
        .where(and(eq(kfcForm21T.id, id), eq(kfcForm21T.display, "Y")))
        .limit(1);
      if (!header) return NextResponse.json({ success: false, message: "Form not found" }, { status: 404 });

      const rows = await db
        .select({
          sl: kfcForm21ItemT.sl_no,
          description: kfcForm21ItemT.description,
          item_name: itemMasterT.item_name,
          qty: kfcForm21ItemT.quantity,
          rate: kfcForm21ItemT.book_rate,
          amount: kfcForm21ItemT.book_amount,
        })
        .from(kfcForm21ItemT)
        .leftJoin(itemMasterT, eq(kfcForm21ItemT.item_id, itemMasterT.id))
        .where(and(eq(kfcForm21ItemT.form_id, id), eq(kfcForm21ItemT.display, "Y")))
        .orderBy(asc(kfcForm21ItemT.sl_no));

      const items: KfcLine[] = rows.map((r, i) => ({
        sl: r.sl ?? i + 1,
        name: (r.description || r.item_name || "").trim(),
        qty: num(r.qty),
        rate: num(r.rate),
        amount: num(r.amount),
      }));
      const total = items.reduce((s, r) => s + r.amount, 0);
      return NextResponse.json({ success: true, data: { title: header.title, date: header.date, items, total } });
    }

    return NextResponse.json({ success: false, message: "Unknown form kind" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
