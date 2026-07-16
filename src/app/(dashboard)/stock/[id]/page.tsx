import Link from "next/link";
import { notFound } from "next/navigation";
import { aliasedTable, and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  stockTransactionT,
  stockBookT,
  itemMasterT,
  issuedToMasterT,
  indentMasterT,
} from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Package, Hash, ArrowRightLeft } from "lucide-react";

const typeColor: Record<string, string> = {
  RECEIPT: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  ISSUE: "bg-rose-500/15 text-rose-500 ring-rose-500/25",
  TRANSFER: "bg-blue-500/15 text-blue-500 ring-blue-500/25",
  ADJUSTMENT: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  BROUGHT_FORWARD: "bg-slate-500/15 text-muted ring-slate-500/25",
};

export default async function StockTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const txnId = Number(id);
  if (!Number.isInteger(txnId) || txnId <= 0) notFound();

  const toLoc = aliasedTable(issuedToMasterT, "to_loc");
  const fromLoc = aliasedTable(issuedToMasterT, "from_loc");

  const [txn] = await db
    .select({
      id: stockTransactionT.id,
      transaction_date: stockTransactionT.transaction_date,
      transaction_type: stockTransactionT.transaction_type,
      stock_entry_type: stockTransactionT.stock_entry_type,
      item_type: stockTransactionT.item_type,
      item_category: stockTransactionT.item_category,
      book_volume: stockTransactionT.book_volume,
      voucher_no: stockTransactionT.voucher_no,
      voucher_date: stockTransactionT.voucher_date,
      receipt_qty: stockTransactionT.receipt_qty,
      issue_qty: stockTransactionT.issue_qty,
      balance_qty: stockTransactionT.balance_qty,
      brought_forward: stockTransactionT.brought_forward,
      carried_over: stockTransactionT.carried_over,
      item_status: stockTransactionT.item_status,
      make: stockTransactionT.make,
      model: stockTransactionT.model,
      description: stockTransactionT.description,
      serial_no: stockTransactionT.serial_no,
      remarks: stockTransactionT.remarks,
      batch_code: stockTransactionT.batch_code,
      item_name: itemMasterT.item_name,
      location: stockBookT.location,
      to_name: toLoc.location_name,
      from_name: fromLoc.location_name,
      indent_id: stockTransactionT.indent_id,
      indent_no: indentMasterT.indent_no,
    })
    .from(stockTransactionT)
    .leftJoin(stockBookT, eq(stockTransactionT.stock_book_id, stockBookT.id))
    .leftJoin(itemMasterT, eq(stockBookT.item_id, itemMasterT.id))
    .leftJoin(toLoc, eq(stockTransactionT.issued_to_location_id, toLoc.id))
    .leftJoin(fromLoc, eq(stockTransactionT.transferred_from_location_id, fromLoc.id))
    .leftJoin(indentMasterT, eq(stockTransactionT.indent_id, indentMasterT.id))
    .where(and(eq(stockTransactionT.id, txnId), eq(stockTransactionT.display, "Y")))
    .limit(1);

  if (!txn) notFound();

  const field = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-faint">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium text-fg">{value || "—"}</dd>
    </div>
  );

  const typeBadge = (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        typeColor[txn.transaction_type] ?? "bg-slate-500/15 text-muted ring-slate-500/25"
      }`}
    >
      {txn.transaction_type}
    </span>
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
                  {txn.item_name || "Stock Transaction"}
                </h1>
                {typeBadge}
              </div>
              <p className="mt-1 text-sm text-brand-100/90">
                Transaction #{txn.id} · {formatDate(txn.transaction_date)}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href="/stock"
                className={buttonClasses({ variant: "outline", size: "sm" })}
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </div>
          </div>

          {/* Summary chips */}
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
              <Package className="h-3.5 w-3.5" /> Balance {txn.balance_qty}
            </span>
            {!!txn.receipt_qty && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                <Hash className="h-3.5 w-3.5" /> +{txn.receipt_qty} received
              </span>
            )}
            {!!txn.issue_qty && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                <ArrowRightLeft className="h-3.5 w-3.5" /> −{txn.issue_qty} issued
              </span>
            )}
          </div>
        </div>

        <CardContent className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {field("Date", formatDate(txn.transaction_date))}
            {field("Type", typeBadge)}
            {field("Entry Type", txn.stock_entry_type)}
            {field("Item", txn.item_name)}
            {field("Item Type", txn.item_type)}
            {field("Category", txn.item_category)}
            {field("Location", txn.location)}
            {field("Book Volume", txn.book_volume)}
            {field("Voucher No", txn.voucher_no)}
            {field("Voucher Date", txn.voucher_date ? formatDate(txn.voucher_date) : null)}
            {field(
              "Indent",
              txn.indent_id ? (
                <Link href={`/indent/${txn.indent_id}`} className="text-accent hover:underline">
                  {txn.indent_no || `#${txn.indent_id}`}
                </Link>
              ) : null
            )}
            {field("Status", txn.item_status)}
            {field("Received", txn.receipt_qty || null)}
            {field("Issued", txn.issue_qty || null)}
            {field("Balance", txn.balance_qty)}
            {field("Brought Forward", txn.brought_forward || null)}
            {field("Carried Over", txn.carried_over || null)}
            {field("To", txn.to_name)}
            {field("From", txn.from_name)}
            {field("Make", txn.make)}
            {field("Model", txn.model)}
            {field("Serial No", txn.serial_no)}
            {field("Batch Code", txn.batch_code)}
          </dl>

          {txn.description && (
            <div className="rounded-lg border border-line bg-elevated/60 p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-faint">
                Description
              </div>
              <p className="mt-1 text-sm text-fg">{txn.description}</p>
            </div>
          )}
          {txn.remarks && (
            <div className="rounded-lg border border-line bg-elevated/60 p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-faint">
                Remarks
              </div>
              <p className="mt-1 text-sm text-fg">{txn.remarks}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
