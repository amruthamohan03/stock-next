"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";

export type StockBookOption = { id: number; name: string };

export type StockInitial = {
  id: number;
  stock_book_id: string;
  transaction_type: string;
  transaction_date: string;
  qty: string;
  voucher_no: string;
  voucher_date: string;
  item_status: string;
  make: string;
  model: string;
  serial_no: string;
  description: string;
  remarks: string;
};

const TYPE_OPTS = [
  { value: "RECEIPT", label: "Receipt (add stock)" },
  { value: "ISSUE", label: "Issue (remove stock)" },
  { value: "ADJUSTMENT", label: "Adjustment (+/−)" },
];

const STATUS_OPTS = [
  { value: "WORKING", label: "Working" },
  { value: "NOT_WORKING", label: "Not working" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "CONDEMNED", label: "Condemned" },
  { value: "DELETED", label: "Deleted" },
];

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function StockForm({
  stockBooks,
  initial,
}: {
  stockBooks: StockBookOption[];
  initial?: StockInitial;
}) {
  const router = useRouter();
  const editing = !!initial;

  const [stockBookId, setStockBookId] = useState(initial?.stock_book_id ?? "");
  const [type, setType] = useState(initial?.transaction_type ?? "RECEIPT");
  const [date, setDate] = useState(initial?.transaction_date ?? todayIso());
  const [qty, setQty] = useState(initial?.qty ?? "");
  const [voucherNo, setVoucherNo] = useState(initial?.voucher_no ?? "");
  const [voucherDate, setVoucherDate] = useState(initial?.voucher_date ?? "");
  const [itemStatus, setItemStatus] = useState(initial?.item_status ?? "WORKING");
  const [make, setMake] = useState(initial?.make ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [serialNo, setSerialNo] = useState(initial?.serial_no ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const bookOpts = stockBooks.map((b) => ({ value: b.id, label: b.name }));

  const reset = () => {
    setStockBookId("");
    setType("RECEIPT");
    setDate(todayIso());
    setQty("");
    setVoucherNo("");
    setVoucherDate("");
    setItemStatus("WORKING");
    setMake("");
    setModel("");
    setSerialNo("");
    setDescription("");
    setRemarks("");
    setMsg(null);
  };

  const save = async () => {
    setMsg(null);
    if (!stockBookId) return setMsg({ ok: false, text: "Select a stock book." });
    if (!date) return setMsg({ ok: false, text: "Transaction date is required." });
    if (!qty || Number(qty) === 0) return setMsg({ ok: false, text: "Enter a non-zero quantity." });
    if (type !== "ADJUSTMENT" && Number(qty) < 0)
      return setMsg({ ok: false, text: "Quantity must be positive for receipts and issues." });

    setSaving(true);
    const res = await fetch("/api/stock", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: initial?.id,
        stock_book_id: stockBookId,
        transaction_type: type,
        transaction_date: date,
        qty,
        voucher_no: voucherNo,
        voucher_date: voucherDate,
        item_status: itemStatus,
        make,
        model,
        serial_no: serialNo,
        description,
        remarks,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      if (editing) {
        router.push(`/stock/${initial!.id}`);
        router.refresh();
      } else {
        setMsg({ ok: true, text: json.message });
        reset();
        router.refresh();
      }
    } else {
      setMsg({ ok: false, text: json.message ?? "Save failed" });
    }
  };

  const qtyLabel =
    type === "ISSUE" ? "Quantity issued" : type === "ADJUSTMENT" ? "Adjustment (+/−)" : "Quantity received";

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{editing ? "Edit Stock Transaction" : "New Stock Transaction"}</CardTitle>
          <p className="text-sm text-muted">
            Balance is recalculated automatically for the selected stock book.
          </p>
        </div>
        {editing ? (
          <Button variant="outline" size="sm" onClick={() => router.push(`/stock/${initial!.id}`)}>
            Cancel
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {msg && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ring-1 ${
              msg.ok
                ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20"
                : "bg-red-500/10 text-red-500 ring-red-500/20"
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Label>Stock Book <span className="text-red-500">*</span></Label>
            <SearchableSelect
              value={stockBookId}
              onChange={setStockBookId}
              options={bookOpts}
              placeholder="Item — location"
            />
          </div>
          <div>
            <Label>Type <span className="text-red-500">*</span></Label>
            <SearchableSelect value={type} onChange={setType} options={TYPE_OPTS} />
          </div>
          <div>
            <Label>{qtyLabel} <span className="text-red-500">*</span></Label>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label>Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Item Status</Label>
            <SearchableSelect value={itemStatus} onChange={setItemStatus} options={STATUS_OPTS} />
          </div>
          <div>
            <Label>Voucher No</Label>
            <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} />
          </div>
          <div>
            <Label>Voucher Date</Label>
            <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
          </div>
          <div>
            <Label>Make</Label>
            <Input value={make} onChange={(e) => setMake(e.target.value)} />
          </div>
          <div>
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div>
            <Label>Serial No</Label>
            <Input value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <Label>Remarks</Label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4" />{" "}
            {saving ? "Saving…" : editing ? "Update Transaction" : "Save Transaction"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
