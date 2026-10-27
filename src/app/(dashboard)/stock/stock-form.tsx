"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { apiRequest } from "@/lib/api-client";
import { CheckToggle } from "@/components/ui/check-toggle";
import { FormSection } from "@/components/ui/form-section";
import { formatDate } from "@/lib/utils";

/** An item in the picker: an existing ledger row, or one still to be created. */
export type StockBookOption = { key: string; name: string; has_ledger: boolean };
export type DepartmentOption = { id: number; name: string };
export type LocationOption = { id: number; name: string };
export type IndentBookOption = { id: number; name: string; book_no: number | null };
export type IndentOption = {
  id: number;
  indent_no: string;
  indent_date: string | null;
  book_no: number | null;
  department_id: number | null;
};
/** A row of the Stock Book master — the register an entry is written into. */
export type RegisterOption = {
  id: number;
  name: string;
  book_no: number | null;
  volume: number | null;
};

export type StockInitial = {
  id: number;
  stock_book_id: string;
  stock_book_master_id: string;
  stock_book_page_no: string;
  indent_id: string;
  source: string;
  department_id: string;
  issued_to_location_id: string;
  no_indent_entry: string;
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
  departments,
  registers,
  locations,
  indentBooks,
  indents,
  initial,
}: {
  stockBooks: StockBookOption[];
  departments: DepartmentOption[];
  registers: RegisterOption[];
  locations: LocationOption[];
  indentBooks: IndentBookOption[];
  indents: IndentOption[];
  initial?: StockInitial;
}) {
  const router = useRouter();
  const editing = !!initial;

  const [stockBookId, setStockBookId] = useState(initial?.stock_book_id ?? "");
  const [newLocationId, setNewLocationId] = useState("");
  const [deptId, setDeptId] = useState(initial?.department_id ?? "");
  const [registerId, setRegisterId] = useState(initial?.stock_book_master_id ?? "");
  const [pageNo, setPageNo] = useState(initial?.stock_book_page_no ?? "");
  const [issuedTo, setIssuedTo] = useState(initial?.issued_to_location_id ?? "");
  const [noIndent, setNoIndent] = useState(initial?.no_indent_entry === "Y");
  const [indentId, setIndentId] = useState(initial?.indent_id ?? "");
  // The book is only a filter for the indent list; what gets stored is the
  // indent itself, so it is derived from the chosen indent when editing.
  const [indentBookId, setIndentBookId] = useState(() => {
    const picked = indents.find((i) => String(i.id) === (initial?.indent_id ?? ""));
    return picked?.book_no ? String(picked.book_no) : "";
  });
  const [source, setSource] = useState(initial?.source ?? "");
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

  const bookOpts = stockBooks.map((b) => ({ value: b.key, label: b.name }));
  // Picking an item with no ledger row yet means one has to be opened, and a
  // ledger row is item + location, so the location has to be stated.
  const needsLocation = stockBookId.startsWith("item:");
  const registerOpts = registers.map((r) => ({
    value: String(r.id),
    label: r.book_no
      ? `${r.name} (Book ${r.book_no}${r.volume && r.volume > 1 ? `, Vol ${r.volume}` : ""})`
      : r.name,
  }));
  const indentBookOpts = indentBooks.map((b) => ({
    value: String(b.id),
    label: b.book_no ? `${b.name} (Book ${b.book_no})` : b.name,
  }));
  // Only the indents of the chosen book, so the list stays short.
  const indentOpts = indents
    .filter((i) => !indentBookId || String(i.book_no) === indentBookId)
    .map((i) => ({
      value: String(i.id),
      label: `Indent ${i.indent_no}${i.indent_date ? ` · ${formatDate(i.indent_date)}` : ""}`,
    }));
  const pickedIndent = indents.find((i) => String(i.id) === indentId) ?? null;

  // One list for the three kinds of source, prefixed so they stay apart.
  const sourceOpts = [
    { value: "stock", label: "Stock · main store" },
    ...departments.map((d) => ({ value: `dept:${d.id}`, label: `Department · ${d.name}` })),
    ...locations.map((l) => ({ value: `loc:${l.id}`, label: `Location · ${l.name}` })),
  ];
  if (source && !sourceOpts.some((o) => o.value === source)) {
    sourceOpts.unshift({ value: source, label: `${source} (not in master)` });
  }

  const locationOpts = locations.map((l) => ({ value: String(l.id), label: l.name }));
  if (issuedTo && !locationOpts.some((o) => o.value === issuedTo)) {
    locationOpts.unshift({ value: issuedTo, label: `Location ${issuedTo} (not in master)` });
  }

  // A transaction filed against a register that was later removed keeps showing
  // it, instead of the select falling back to a blank box.
  if (registerId && !registerOpts.some((o) => o.value === registerId)) {
    registerOpts.unshift({ value: registerId, label: `Stock book ${registerId} (not in master)` });
  }
  const deptOpts = departments.map((d) => ({ value: String(d.id), label: d.name }));
  // Older transactions can carry a department that is no longer in the master;
  // show it rather than rendering an empty select.
  if (deptId && !deptOpts.some((o) => o.value === deptId)) {
    deptOpts.unshift({ value: deptId, label: `Department ${deptId} (not in master)` });
  }

  const reset = () => {
    setStockBookId("");
    setNewLocationId("");
    setRegisterId("");
    setPageNo("");
    setIssuedTo("");
    setNoIndent(false);
    setIndentId("");
    setIndentBookId("");
    setSource("");
    setDeptId("");
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
    if (!stockBookId) return setMsg({ ok: false, text: "Select an item." });
    if (needsLocation && !newLocationId)
      return setMsg({ ok: false, text: "Choose where this item is kept — it has no stock book yet." });
    if (!deptId) return setMsg({ ok: false, text: "Select a department." });
    if (!date) return setMsg({ ok: false, text: "Transaction date is required." });
    if (!qty || Number(qty) === 0) return setMsg({ ok: false, text: "Enter a non-zero quantity." });
    if (type !== "ADJUSTMENT" && Number(qty) < 0)
      return setMsg({ ok: false, text: "Quantity must be positive for receipts and issues." });

    setSaving(true);
    const result = await apiRequest("/api/stock", {
      method: editing ? "PUT" : "POST",
      body: {
        id: initial?.id,
        stock_book_id: stockBookId,
        new_location_id: needsLocation ? newLocationId : "",
        stock_book_master_id: registerId,
        stock_book_page_no: pageNo,
        department_id: deptId,
        // Only meaningful when stock leaves the store.
        issued_to_location_id: type === "ISSUE" ? issuedTo : "",
        no_indent_entry: noIndent ? "Y" : "N",
        // An indent is only meaningful when the entry claims to have one.
        indent_id: noIndent ? "" : indentId,
        source,
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
      },
    });
    setSaving(false);
    if (result.success) {
      if (editing) {
        router.push(`/stock/${initial!.id}`);
        router.refresh();
      } else {
        setMsg({ ok: true, text: result.message });
        reset();
        router.refresh();
      }
    } else {
      setMsg({ ok: false, text: result.message });
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
      <CardContent className="space-y-6">
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

        <FormSection title="Item & Register" hint="what the entry is against">
          <div className="sm:col-span-2">
            <Label>Item <span className="text-red-500">*</span></Label>
            <SearchableSelect
              value={stockBookId}
              onChange={setStockBookId}
              options={bookOpts}
              placeholder="Select an item"
            />
          </div>
          {needsLocation && (
            <div>
              <Label>Location <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={newLocationId}
                onChange={setNewLocationId}
                options={locationOpts}
                placeholder="Where is it kept?"
              />
              <p className="mt-1 text-xs text-muted">
                First entry for this item — its stock book is opened here.
              </p>
            </div>
          )}
          <div>
            <Label>Stock Book</Label>
            <SearchableSelect
              value={registerId}
              onChange={setRegisterId}
              options={registerOpts}
              placeholder={
                registers.length ? "Select a stock book" : "No stock books in the master yet"
              }
            />
          </div>
          <div>
            <Label>Page No</Label>
            <Input
              type="number"
              min={1}
              value={pageNo}
              onChange={(e) => setPageNo(e.target.value)}
              placeholder="Page in that book"
            />
          </div>
        </FormSection>

        <FormSection title="Entry">
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
            <Label>Department <span className="text-red-500">*</span></Label>
            <SearchableSelect
              value={deptId}
              onChange={setDeptId}
              options={deptOpts}
              placeholder="Select a department"
            />
          </div>
          <div>
            <Label>Item Status</Label>
            <SearchableSelect value={itemStatus} onChange={setItemStatus} options={STATUS_OPTS} />
          </div>
          {type === "ISSUE" && (
            <div>
              <Label>Issued To</Label>
              <SearchableSelect
                value={issuedTo}
                onChange={setIssuedTo}
                options={locationOpts}
                placeholder={locations.length ? "Select a location" : "No locations yet"}
              />
            </div>
          )}
        </FormSection>

        <FormSection title="Indent & Source" hint="where the stock came from">
          <div className="sm:col-span-2 lg:col-span-4">
            <CheckToggle
              checked={noIndent}
              onChange={(v) => {
                setNoIndent(v);
                if (v) {
                  setIndentId("");
                  setIndentBookId("");
                }
              }}
              label="No indent entry"
              hint="Tick for stock received without an indent — direct purchase, donation or an opening balance."
            />
          </div>
          {!noIndent && (
            <>
              <div>
                <Label>Indent Book</Label>
                <SearchableSelect
                  value={indentBookId}
                  onChange={(v) => {
                    setIndentBookId(v);
                    setIndentId("");
                  }}
                  options={indentBookOpts}
                  placeholder={indentBooks.length ? "All indent books" : "No indent books yet"}
                />
              </div>
              <div>
                <Label>Indent No</Label>
                <SearchableSelect
                  value={indentId}
                  onChange={setIndentId}
                  options={indentOpts}
                  placeholder={indentOpts.length ? "Select an indent" : "No indents in this book"}
                />
              </div>
              <div>
                <Label>Indent Date</Label>
                <Input
                  readOnly
                  value={pickedIndent?.indent_date ? formatDate(pickedIndent.indent_date) : ""}
                  placeholder="From the selected indent"
                  className="cursor-default"
                />
              </div>
            </>
          )}
          <div>
            <Label>Transferred From</Label>
            <SearchableSelect
              value={source}
              onChange={setSource}
              options={sourceOpts}
              placeholder="Not transferred"
            />
          </div>
        </FormSection>

        <FormSection title="Article Details" hint="optional">
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
        </FormSection>

        <FormSection title="Notes" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg shadow-sm transition-colors placeholder:text-faint hover:border-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35"
            />
          </div>
          <div>
            <Label>Remarks</Label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg shadow-sm transition-colors placeholder:text-faint hover:border-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35"
            />
          </div>
        </FormSection>

        <div className="flex justify-end">
          <Button onClick={save} loading={saving} size="lg">
            {!saving && <Save className="h-4 w-4" />}
            {saving ? "Saving…" : editing ? "Update Transaction" : "Save Transaction"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
