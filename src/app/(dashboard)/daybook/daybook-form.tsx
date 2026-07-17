"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, RotateCcw, Save, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TableAction } from "@/components/ui/table-action";
import type { Opt } from "./options";

export type LineRow = {
  item_id: string;
  item_description: string;
  unit_id: string;
  // receipt side
  receipt_qty_number: string;
  receipt_qty_weight: string;
  receipt_rate: string;
  receipt_amount_rs: string;
  receipt_amount_ps: string;
  // issue side
  issue_qty_number: string;
  issue_qty_weight: string;
  issue_rate: string;
  issue_amount_rs: string;
  issue_amount_ps: string;
  // shared / balance
  balance_rate: string;
  balance_amount_ps: string;
  // issue-only
  indent_no: string;
  indent_date: string;
  issued_to_id: string;
};

export type DaybookInitial = {
  id: number;
  page_no: string;
  stockbook_type_id: string;
  class: string;
  unit_label: string;
  receipt_order_no: string;
  document_date: string;
  service_provider_id: string;
  invoice_ref: string;
  invoice_date: string;
  issued_to_id: string;
  cr_voucher_ref: string;
  verifier_id: string;
  remarks: string;
  receipt_items: LineRow[];
  issue_items: LineRow[];
};

type Row = LineRow & { key: number };

const blankLine = (key: number): Row => ({
  key,
  item_id: "",
  item_description: "",
  unit_id: "",
  receipt_qty_number: "",
  receipt_qty_weight: "",
  receipt_rate: "",
  receipt_amount_rs: "",
  receipt_amount_ps: "",
  issue_qty_number: "",
  issue_qty_weight: "",
  issue_rate: "",
  issue_amount_rs: "",
  issue_amount_ps: "",
  balance_rate: "",
  balance_amount_ps: "",
  indent_no: "",
  indent_date: "",
  issued_to_id: "",
});

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const cell = "w-full bg-transparent px-1 py-1 text-xs text-fg outline-none focus:bg-accent-soft/40";
const num = (v: string) => Number(v) || 0;

export default function DaybookForm({
  stockbookTypes,
  units,
  items,
  providers,
  issuedTo,
  users,
  initial,
}: {
  stockbookTypes: Opt[];
  units: Opt[];
  items: Opt[];
  providers: Opt[];
  issuedTo: Opt[];
  users: Opt[];
  initial?: DaybookInitial;
}) {
  const router = useRouter();
  const editing = !!initial;
  const keyRef = useState(() => ({ n: 0 }))[0];

  const [pageNo, setPageNo] = useState(initial?.page_no ?? "");
  const [typeId, setTypeId] = useState(initial?.stockbook_type_id ?? "");
  const [klass, setKlass] = useState(initial?.class ?? "");
  const [unitLabel, setUnitLabel] = useState(initial?.unit_label ?? "");
  const [providerId, setProviderId] = useState(initial?.service_provider_id ?? "");
  const [docDate, setDocDate] = useState(initial?.document_date || todayIso());
  const [orderNo, setOrderNo] = useState(initial?.receipt_order_no ?? "");
  const [invoiceRef, setInvoiceRef] = useState(initial?.invoice_ref ?? "");
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoice_date ?? "");
  const [crVoucher, setCrVoucher] = useState(initial?.cr_voucher_ref ?? "");
  const [issuedToId, setIssuedToId] = useState(initial?.issued_to_id ?? "");
  const [verifierId, setVerifierId] = useState(initial?.verifier_id ?? "");
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");

  const [receipts, setReceipts] = useState<Row[]>(() =>
    initial?.receipt_items.length
      ? initial.receipt_items.map((r) => ({ ...r, key: keyRef.n++ }))
      : [blankLine(keyRef.n++)]
  );
  const [issues, setIssues] = useState<Row[]>(() =>
    initial?.issue_items.map((r) => ({ ...r, key: keyRef.n++ })) ?? []
  );

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const opts = (list: Opt[]) => list.map((o) => ({ value: String(o.id), label: o.name }));
  const typeOpts = useMemo(() => opts(stockbookTypes), [stockbookTypes]);
  const unitOpts = useMemo(() => opts(units), [units]);
  const itemOpts = useMemo(() => opts(items), [items]);
  const providerOpts = useMemo(() => opts(providers), [providers]);
  const issuedToOpts = useMemo(() => opts(issuedTo), [issuedTo]);
  const userOpts = useMemo(() => opts(users), [users]);

  const setLine = (
    setter: React.Dispatch<React.SetStateAction<Row[]>>,
    key: number,
    patch: Partial<Row>
  ) => setter((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const reset = () => {
    setPageNo(""); setTypeId(""); setKlass(""); setUnitLabel(""); setProviderId("");
    setDocDate(todayIso()); setOrderNo(""); setInvoiceRef(""); setInvoiceDate("");
    setCrVoucher(""); setIssuedToId(""); setVerifierId(""); setRemarks("");
    setReceipts([blankLine(keyRef.n++)]);
    setIssues([]);
    setMsg(null);
  };

  const strip = (r: Row) => {
    const { key: _key, ...rest } = r;
    return rest;
  };

  const save = async () => {
    setMsg(null);
    if (!pageNo.trim()) return setMsg({ ok: false, text: "Page number is required." });
    if (!typeId) return setMsg({ ok: false, text: "Select a stockbook type." });
    if (!docDate) return setMsg({ ok: false, text: "Document date is required." });
    if (!providerId) return setMsg({ ok: false, text: "Select a service provider." });
    const r = receipts.filter((x) => x.item_id);
    if (r.length === 0) return setMsg({ ok: false, text: "Add at least one receipt item line." });

    setSaving(true);
    const res = await fetch("/api/daybook", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: initial?.id,
        page_no: pageNo,
        stockbook_type_id: typeId,
        class: klass,
        unit_label: unitLabel,
        receipt_order_no: orderNo,
        document_date: docDate,
        service_provider_id: providerId,
        invoice_ref: invoiceRef,
        invoice_date: invoiceDate,
        issued_to_id: issuedToId,
        cr_voucher_ref: crVoucher,
        verifier_id: verifierId,
        remarks,
        receipt_items: r.map(strip),
        issue_items: issues.filter((x) => x.item_id).map(strip),
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      if (editing) {
        router.push(`/daybook/${initial!.id}`);
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

  /** Balance Rs. is derived (receipt − issue), same rule the server applies. */
  const balanceOf = (r: Row) => (num(r.receipt_amount_rs) - num(r.issue_amount_rs)).toFixed(2);

  const lineTable = (
    kind: "RECEIPT" | "ISSUE",
    rows: Row[],
    setter: React.Dispatch<React.SetStateAction<Row[]>>
  ) => {
    const isReceipt = kind === "RECEIPT";
    return (
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-xs" style={{ minWidth: isReceipt ? "70rem" : "82rem" }}>
          <thead>
            <tr className="border-b border-line bg-elevated text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="w-8 px-2 py-2 text-center font-semibold">#</th>
              <th className="min-w-[11rem] px-2 py-2 font-semibold">Item <span className="text-red-500">*</span></th>
              <th className="min-w-[10rem] px-2 py-2 font-semibold">Description</th>
              <th className="min-w-[6rem] px-2 py-2 font-semibold">Unit</th>
              <th className="px-2 py-2 text-center font-semibold" colSpan={2}>{isReceipt ? "Receipt" : "Issue"} Qty</th>
              <th className="px-2 py-2 text-center font-semibold" colSpan={3}>{isReceipt ? "Receipt" : "Issue"} Value</th>
              <th className="px-2 py-2 text-center font-semibold" colSpan={3}>Balance</th>
              {!isReceipt && <th className="min-w-[8rem] px-2 py-2 font-semibold">Indent No</th>}
              {!isReceipt && <th className="min-w-[8rem] px-2 py-2 font-semibold">Indent Date</th>}
              {!isReceipt && <th className="min-w-[8rem] px-2 py-2 font-semibold">Issued To</th>}
              <th className="w-10 px-2 py-2" />
            </tr>
            <tr className="border-b border-line bg-elevated/60 text-left text-[10px] text-faint">
              <th /><th /><th /><th />
              <th className="px-2 py-1 font-normal">No.</th>
              <th className="px-2 py-1 font-normal">Wt/Msr</th>
              <th className="px-2 py-1 font-normal">Rate</th>
              <th className="px-2 py-1 font-normal">Rs.</th>
              <th className="px-2 py-1 font-normal">Ps.</th>
              <th className="px-2 py-1 font-normal">Rate</th>
              <th className="px-2 py-1 font-normal">Rs.</th>
              <th className="px-2 py-1 font-normal">Ps.</th>
              {!isReceipt && <th />}
              {!isReceipt && <th />}
              {!isReceipt && <th />}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={isReceipt ? 13 : 16} className="px-2 py-6 text-center text-faint">
                  No {isReceipt ? "receipt" : "issue"} lines. Use “Add row”.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.key} className="border-b border-line/60 align-top">
                <td className="px-2 py-2 text-center text-faint">{i + 1}</td>
                <td className="px-2 py-2">
                  <SearchableSelect
                    value={r.item_id}
                    onChange={(v) => {
                      const it = items.find((x) => String(x.id) === v);
                      setLine(setter, r.key, {
                        item_id: v,
                        item_description: r.item_description || (it ? it.name : ""),
                      });
                    }}
                    options={itemOpts}
                    placeholder="Item"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    value={r.item_description}
                    onChange={(e) => setLine(setter, r.key, { item_description: e.target.value })}
                    className={cell}
                  />
                </td>
                <td className="px-2 py-2">
                  <SearchableSelect
                    value={r.unit_id}
                    onChange={(v) => setLine(setter, r.key, { unit_id: v })}
                    options={unitOpts}
                    placeholder="Unit"
                  />
                </td>
                {/* Qty */}
                <td className="px-2 py-2">
                  <input
                    inputMode="decimal"
                    value={isReceipt ? r.receipt_qty_number : r.issue_qty_number}
                    onChange={(e) =>
                      setLine(setter, r.key, isReceipt
                        ? { receipt_qty_number: e.target.value }
                        : { issue_qty_number: e.target.value })
                    }
                    className={`${cell} text-right`}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    inputMode="decimal"
                    value={isReceipt ? r.receipt_qty_weight : r.issue_qty_weight}
                    onChange={(e) =>
                      setLine(setter, r.key, isReceipt
                        ? { receipt_qty_weight: e.target.value }
                        : { issue_qty_weight: e.target.value })
                    }
                    className={`${cell} text-right`}
                  />
                </td>
                {/* Value */}
                <td className="px-2 py-2">
                  <input
                    inputMode="decimal"
                    value={isReceipt ? r.receipt_rate : r.issue_rate}
                    onChange={(e) =>
                      setLine(setter, r.key, isReceipt
                        ? { receipt_rate: e.target.value }
                        : { issue_rate: e.target.value })
                    }
                    className={`${cell} text-right`}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    inputMode="decimal"
                    value={isReceipt ? r.receipt_amount_rs : r.issue_amount_rs}
                    onChange={(e) =>
                      setLine(setter, r.key, isReceipt
                        ? { receipt_amount_rs: e.target.value }
                        : { issue_amount_rs: e.target.value })
                    }
                    className={`${cell} text-right`}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    inputMode="decimal"
                    value={isReceipt ? r.receipt_amount_ps : r.issue_amount_ps}
                    onChange={(e) =>
                      setLine(setter, r.key, isReceipt
                        ? { receipt_amount_ps: e.target.value }
                        : { issue_amount_ps: e.target.value })
                    }
                    className={`${cell} text-right`}
                  />
                </td>
                {/* Balance */}
                <td className="px-2 py-2">
                  <input
                    inputMode="decimal"
                    value={r.balance_rate}
                    onChange={(e) => setLine(setter, r.key, { balance_rate: e.target.value })}
                    className={`${cell} text-right`}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    value={balanceOf(r)}
                    readOnly
                    title="Auto: Receipt Rs. − Issue Rs."
                    className={`${cell} cursor-default rounded bg-elevated text-right text-faint`}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    inputMode="decimal"
                    value={r.balance_amount_ps}
                    onChange={(e) => setLine(setter, r.key, { balance_amount_ps: e.target.value })}
                    className={`${cell} text-right`}
                  />
                </td>
                {/* Issue-only columns */}
                {!isReceipt && (
                  <td className="px-2 py-2">
                    <input
                      value={r.indent_no}
                      onChange={(e) => setLine(setter, r.key, { indent_no: e.target.value })}
                      placeholder="e.g. Tkp/1432"
                      className={cell}
                    />
                  </td>
                )}
                {!isReceipt && (
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={r.indent_date}
                      onChange={(e) => setLine(setter, r.key, { indent_date: e.target.value })}
                      className={cell}
                    />
                  </td>
                )}
                {!isReceipt && (
                  <td className="px-2 py-2">
                    <SearchableSelect
                      value={r.issued_to_id}
                      onChange={(v) => setLine(setter, r.key, { issued_to_id: v })}
                      options={issuedToOpts}
                      placeholder="Issued to"
                    />
                  </td>
                )}
                <td className="px-2 py-2">
                  <TableAction
                    tone="delete"
                    icon={Trash2}
                    onClick={() => setter((rs) => rs.filter((x) => x.key !== r.key))}
                    title="Remove row"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            {editing ? `Edit Day Book Entry` : "K.F.C. Form 16 — Create Day Book Entry"}
          </CardTitle>
          <p className="text-sm text-muted">Day Book of Stores — receipts and issues for one document.</p>
        </div>
        {editing ? (
          <Button variant="outline" size="sm" onClick={() => router.push(`/daybook/${initial!.id}`)}>
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

        {/* Master header */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Page No <span className="text-red-500">*</span></Label>
            <Input value={pageNo} onChange={(e) => setPageNo(e.target.value)} placeholder="e.g. 132" />
          </div>
          <div>
            <Label>Stockbook Type <span className="text-red-500">*</span></Label>
            <SearchableSelect value={typeId} onChange={setTypeId} options={typeOpts} placeholder="Select" />
          </div>
          <div>
            <Label>Class</Label>
            <Input value={klass} onChange={(e) => setKlass(e.target.value)} />
          </div>
          <div>
            <Label>Unit</Label>
            <Input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>By Whom Received / Provider <span className="text-red-500">*</span></Label>
            <SearchableSelect value={providerId} onChange={setProviderId} options={providerOpts} placeholder="Select provider" />
          </div>
          <div>
            <Label>Document Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          </div>
          <div>
            <Label>Order / Ref No</Label>
            <Input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="e.g. GraNkm/261/2025-P" />
          </div>
          <div>
            <Label>Invoice Ref</Label>
            <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} />
          </div>
          <div>
            <Label>Invoice Date</Label>
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div>
            <Label>CR Voucher Ref</Label>
            <Input value={crVoucher} onChange={(e) => setCrVoucher(e.target.value)} />
          </div>
          <div>
            <Label>Issued To</Label>
            <SearchableSelect value={issuedToId} onChange={setIssuedToId} options={issuedToOpts} placeholder="Select" />
          </div>
          <div>
            <Label>Verifier</Label>
            <SearchableSelect value={verifierId} onChange={setVerifierId} options={userOpts} placeholder="Select" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label>Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks / notes" />
          </div>
        </div>

        {/* Receipt lines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <ArrowDownCircle className="h-4 w-4" /> Receipt Items <span className="text-red-500">*</span>
            </h3>
            <Button variant="outline" size="sm" onClick={() => setReceipts((rs) => [...rs, blankLine(keyRef.n++)])}>
              <Plus className="h-4 w-4" /> Add row
            </Button>
          </div>
          {lineTable("RECEIPT", receipts, setReceipts)}
        </div>

        {/* Issue lines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-rose-600">
              <ArrowUpCircle className="h-4 w-4" /> Issue Items
            </h3>
            <Button variant="outline" size="sm" onClick={() => setIssues((rs) => [...rs, blankLine(keyRef.n++)])}>
              <Plus className="h-4 w-4" /> Add row
            </Button>
          </div>
          {lineTable("ISSUE", issues, setIssues)}
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4" />{" "}
            {saving ? "Saving…" : editing ? "Update Entry" : "Save Entry"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
