import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc, and } from "drizzle-orm";
import { db } from "@/db";
import {
  indentMasterT,
  indentItemT,
  departmentMasterT,
  groupItemNameMasterT,
  itemMasterT,
  makeT,
  modelT,
} from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Pencil, ArrowLeft, Package, Hash, Receipt } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import BillAttachment from "../bill-attachment";

export default async function IndentViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const indentId = Number(id);
  if (!indentId) notFound();

  const [header] = await db
    .select({
      id: indentMasterT.id,
      book_no: indentMasterT.book_no,
      indent_no: indentMasterT.indent_no,
      indent_date: indentMasterT.indent_date,
      purpose: indentMasterT.purpose,
      item_type: indentMasterT.item_type,
      status: indentMasterT.status,
      department_name: departmentMasterT.department_name,
      bill_path: indentMasterT.bill_path,
      bill_name: indentMasterT.bill_name,
      bill_type: indentMasterT.bill_type,
    })
    .from(indentMasterT)
    .leftJoin(departmentMasterT, eq(indentMasterT.department_id, departmentMasterT.id))
    .where(and(eq(indentMasterT.id, indentId), eq(indentMasterT.display, "Y")))
    .limit(1);

  if (!header) notFound();

  const items = await db
    .select({
      id: indentItemT.id,
      sl_no: indentItemT.sl_no,
      item_name: itemMasterT.item_name,
      group_name: groupItemNameMasterT.group_name,
      make_name: makeT.make_name,
      model_name: modelT.model_name,
      item_description: indentItemT.item_description,
      item_purpose: indentItemT.item_purpose,
      qty_intended: indentItemT.qty_intended,
      remarks: indentItemT.remarks,
    })
    .from(indentItemT)
    .leftJoin(itemMasterT, eq(indentItemT.item_id, itemMasterT.id))
    .leftJoin(groupItemNameMasterT, eq(indentItemT.group_id, groupItemNameMasterT.id))
    .leftJoin(makeT, eq(indentItemT.make_id, makeT.id))
    .leftJoin(modelT, eq(indentItemT.model_id, modelT.id))
    .where(and(eq(indentItemT.indent_id, indentId), eq(indentItemT.display, "Y")))
    .orderBy(asc(indentItemT.sl_no));

  const totalQty = items.reduce((s, it) => s + (it.qty_intended ?? 0), 0);

  const field = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium text-slate-700">{value || "—"}</dd>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <Card className="overflow-hidden">
        <div className="bg-brand-hero px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-lg font-semibold text-white sm:text-xl">
                  Indent {header.indent_no}
                </h1>
                <StatusBadge status={header.status} />
              </div>
              <p className="mt-1 text-sm text-brand-100/90">
                Government Polytechnic College Nedumkandam
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href="/indent"
                className={buttonClasses({ variant: "outline", size: "sm" })}
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
              <Link
                href={`/indent/${header.id}/edit`}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </div>
          </div>

          {/* Summary chips */}
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
              <Package className="h-3.5 w-3.5" /> {items.length} items
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
              <Hash className="h-3.5 w-3.5" /> {totalQty} total qty
            </span>
          </div>
        </div>

        <CardContent className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {field("Book No", header.book_no)}
            {field("Indent No", header.indent_no)}
            {field("Date", formatDate(header.indent_date))}
            {field("Type", header.item_type === "C" ? "Consumable" : "Non-consumable")}
            {field("Department", header.department_name)}
            {field("Status", <StatusBadge status={header.status} />)}
          </dl>
          {header.purpose && (
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Purpose
              </div>
              <p className="mt-1 text-sm text-slate-700">{header.purpose}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bill attachment */}
      <Card>
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Receipt className="h-4 w-4 text-accent" />
          <h2 className="text-base font-semibold text-fg">Bill / Attachment</h2>
        </div>
        <CardContent>
          <BillAttachment
            indentId={header.id}
            bill={
              header.bill_path
                ? { path: header.bill_path, name: header.bill_name, type: header.bill_type }
                : null
            }
          />
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800">Items</h2>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            {items.length}
          </span>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: "64rem" }}>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Group</th>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Make</th>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                  <th className="px-4 py-3 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      No items.
                    </td>
                  </tr>
                )}
                {items.map((it, i) => (
                  <tr
                    key={it.id}
                    className="border-b border-slate-50 text-slate-600 transition-colors hover:bg-brand-50/40"
                  >
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3">{it.group_name || "—"}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{it.item_name || "—"}</td>
                    <td className="px-4 py-3">{it.make_name || "—"}</td>
                    <td className="px-4 py-3">{it.model_name || "—"}</td>
                    <td className="px-4 py-3">{it.item_description || "—"}</td>
                    <td className="px-4 py-3">{it.item_purpose || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">
                      {it.qty_intended}
                    </td>
                    <td className="px-4 py-3">{it.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
              {items.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/70 font-medium text-slate-700">
                    <td colSpan={7} className="px-4 py-3 text-right">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{totalQty}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
