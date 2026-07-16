import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { kfcForm13T, kfcForm21T } from "@/db/schema";

export type KfcFormOption = { value: string; label: string };

const fmt = (d: string | Date | null) => {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, dd] = s.split("-");
  return dd ? `${dd}-${m}-${y}` : s;
};

/**
 * Saved KFC forms (Form 13 + Form 21) offered as the basis for a document.
 * Value is encoded as "form13:<id>" / "form21:<id>" for the builder to resolve.
 */
export async function getKfcFormOptions(): Promise<KfcFormOption[]> {
  const [f13, f21] = await Promise.all([
    db
      .select({ id: kfcForm13T.id, title: kfcForm13T.title, form_date: kfcForm13T.form_date })
      .from(kfcForm13T)
      .where(eq(kfcForm13T.display, "Y"))
      .orderBy(desc(kfcForm13T.id)),
    db
      .select({ id: kfcForm21T.id, title: kfcForm21T.title, form_date: kfcForm21T.form_date })
      .from(kfcForm21T)
      .where(eq(kfcForm21T.display, "Y"))
      .orderBy(desc(kfcForm21T.id)),
  ]);

  return [
    ...f13.map((r) => ({
      value: `form13:${r.id}`,
      label: `KFC 13 · ${r.title}${r.form_date ? ` (${fmt(r.form_date)})` : ""}`,
    })),
    ...f21.map((r) => ({
      value: `form21:${r.id}`,
      label: `KFC 21 · ${r.title}${r.form_date ? ` (${fmt(r.form_date)})` : ""}`,
    })),
  ];
}
