"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Inbox, Info, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FormSection } from "@/components/ui/form-section";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiPost, apiRequest } from "@/lib/api-client";
import { stockBookLabel } from "@/lib/stock-books";
import { formatDate } from "@/lib/utils";
import type { MoveLine } from "@/lib/stock-book-move";

/** INDENT: pick indents in an indent book. PAGE: pick a page of a stock register. */
type Mode = "INDENT" | "PAGE";
type Action = "MOVE" | "REMOVE";

export type PageCount = { book_id: number; page_no: number; entries: number };
type Book = { id: number; name: string; book_no: number | null; volume: number | null };

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "INDENT", label: "Indent entry", hint: "Pick an indent book, then indents" },
  { value: "PAGE", label: "Stock entry", hint: "Pick a stock book, then a page" },
];
const ACTIONS: { value: Action; label: string; icon: typeof Trash2 }[] = [
  { value: "MOVE", label: "Move", icon: ArrowRightLeft },
  { value: "REMOVE", label: "Remove from stock book", icon: Trash2 },
];

const today = () => new Date().toISOString().slice(0, 10);
const keyOf = (l: MoveLine) => `${l.kind}:${l.id}`;
const bookAndPage = (book: string | null, page: number | null) =>
  book ? `${book}${page != null ? ` (Page No: ${page})` : ""}` : "No stock book";
const pageLabel = (p: PageCount) =>
  `${p.page_no === 0 ? "No page number" : `Page ${p.page_no}`} · ${p.entries} ${p.entries === 1 ? "entry" : "entries"}`;

export default function MoveForm({
  indents,
  indentBooks,
  stockBooks,
  pages,
  users,
  currentUserId,
}: {
  indents: {
    id: number;
    book_id: number;
    indent_no: string | null;
    indent_date: string;
    item_count: number;
    booked_item_count: number;
  }[];
  indentBooks: Book[];
  stockBooks: Book[];
  pages: PageCount[];
  users: { id: number; name: string }[];
  currentUserId: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [action, setAction] = useState<Action>("MOVE");
  const [mode, setMode] = useState<Mode>("INDENT");
  const removing = action === "REMOVE";
  const verb = removing ? "remove" : "move";

  // From — indent mode
  const [fromIndentBook, setFromIndentBook] = useState("");
  const [indentIds, setIndentIds] = useState(""); // comma separated (multi-select)
  // From — stock (page) mode
  const [fromStockBook, setFromStockBook] = useState("");
  const [fromPage, setFromPage] = useState(""); // "0" = no page number

  // To
  const [toIndentBook, setToIndentBook] = useState("");
  const [toIndentNo, setToIndentNo] = useState("");
  const [toIndentDate, setToIndentDate] = useState(today);
  const [toStockBook, setToStockBook] = useState("");
  const [toPage, setToPage] = useState("");

  const [movedDate, setMovedDate] = useState(today);
  const [movedBy, setMovedBy] = useState(currentUserId ? String(currentUserId) : "");
  const [remarks, setRemarks] = useState("");

  const [lines, setLines] = useState<MoveLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Ticked lines: line key → quantity to act on (as typed). */
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const bookOpts = (books: Book[]) => books.map((b) => ({ value: String(b.id), label: stockBookLabel(b) }));
  const indentBookOpts = useMemo(() => bookOpts(indentBooks), [indentBooks]);
  const stockBookOpts = useMemo(() => bookOpts(stockBooks), [stockBooks]);
  const userOpts = useMemo(() => users.map((u) => ({ value: String(u.id), label: u.name })), [users]);

  // Indents in the chosen indent book that still have something for this action.
  const indentOpts = useMemo(
    () =>
      indents
        .filter(
          (i) =>
            String(i.book_id) === fromIndentBook &&
            (removing ? i.booked_item_count > 0 : i.item_count > 0)
        )
        .map((i) => ({
          value: String(i.id),
          label: `Indent No ${i.indent_no ?? i.id} · ${formatDate(i.indent_date)}`,
        })),
    [indents, fromIndentBook, removing]
  );
  const pageOpts = useMemo(
    () =>
      pages
        .filter((p) => String(p.book_id) === fromStockBook)
        .map((p) => ({ value: String(p.page_no), label: pageLabel(p) })),
    [pages, fromStockBook]
  );

  // Drop selections that are no longer offered (emptied by a move, or the book
  // or action changed), so nothing hidden stays selected.
  useEffect(() => {
    if (!indentIds) return;
    const listed = new Set(indentOpts.map((o) => o.value));
    const kept = indentIds.split(",").filter((id) => listed.has(id)).join(",");
    if (kept !== indentIds) setIndentIds(kept);
  }, [indentOpts, indentIds]);
  useEffect(() => {
    if (fromPage && !pageOpts.some((o) => o.value === fromPage)) setFromPage("");
  }, [pageOpts, fromPage]);

  const query =
    mode === "INDENT"
      ? indentIds && `mode=INDENT&indent_ids=${indentIds}`
      : fromStockBook && fromPage !== "" && `mode=PAGE&book_id=${fromStockBook}&page=${fromPage}`;

  useEffect(() => {
    setPicked({});
    setLines([]);
    setLoadError(null);
    if (!query) return;
    let stale = false;
    setLoading(true);
    // `data` is the whole response body; the lines sit in its own `data` field.
    apiRequest<{ data?: MoveLine[] }>(`/api/stock-book-move?${query}`).then((r) => {
      if (stale) return;
      setLoading(false);
      if (r.success) setLines(r.data?.data ?? []);
      else setLoadError(r.message);
    });
    return () => {
      stale = true;
    };
  }, [query, reloadKey]);

  // An indent item is in a stock book only through its register, so removing
  // one needs a register; a stock entry can always be removed.
  const canAct = (l: MoveLine, act: Action) => act !== "REMOVE" || l.kind === "STOCK" || l.book_id !== null;
  const pickable = lines.filter((l) => canAct(l, action));
  const allPicked = pickable.length > 0 && pickable.every((l) => keyOf(l) in picked);
  const toggleAll = () =>
    setPicked(allPicked ? {} : Object.fromEntries(pickable.map((l) => [keyOf(l), String(l.qty)])));
  const toggle = (l: MoveLine) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (keyOf(l) in next) delete next[keyOf(l)];
      else next[keyOf(l)] = String(l.qty);
      return next;
    });

  const switchAction = (next: Action) => {
    setAction(next);
    setError(null);
    setPicked((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([k]) => {
          const line = lines.find((l) => keyOf(l) === k);
          return line ? canAct(line, next) : false;
        })
      )
    );
  };
  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  // Does the target indent exist already, or will the move create it?
  const targetIndent = useMemo(
    () =>
      indents.find(
        (i) =>
          String(i.book_id) === toIndentBook &&
          (i.indent_no ?? "").trim() === toIndentNo.trim() &&
          i.indent_date === toIndentDate
      ),
    [indents, toIndentBook, toIndentNo, toIndentDate]
  );
  const toIndentBookName = indentBooks.find((b) => String(b.id) === toIndentBook)?.name;

  const multiIndent = mode === "INDENT" && indentIds.split(",").filter(Boolean).length > 1;
  const showIndentCol = mode === "PAGE" || multiIndent;
  const hasStockLines = lines.some((l) => l.kind === "STOCK");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = Object.entries(picked);
    const check =
      mode === "INDENT" && !indentIds
        ? "Choose an indent book and at least one indent."
        : mode === "PAGE" && (!fromStockBook || fromPage === "")
          ? "Choose a stock book and a page."
          : chosen.length === 0
            ? `Tick at least one item to ${verb}.`
            : !removing && mode === "INDENT" && (!toIndentBook || !toIndentNo.trim() || !toIndentDate)
              ? "Choose the indent book, indent number and date to move to."
              : !removing && mode === "PAGE" && !toStockBook
                ? "Choose the stock book to move to."
                : !movedDate
                  ? `Enter the date of the ${verb}.`
                  : !movedBy
                    ? `Choose who did the ${verb}.`
                    : null;
    if (check) {
      setError(check);
      return;
    }
    if (removing) {
      const stock = chosen.some(([k]) => k.startsWith("STOCK:"));
      const ok = await confirm({
        title: `Remove ${chosen.length} ${chosen.length === 1 ? "item" : "items"} from the stock book?`,
        description: stock
          ? "Indent items lose their stock book and page. Stock entries are taken out of the stock book and the stock balance goes down. It can be undone from the history below."
          : "They will no longer be entered in any stock book. It can be undone from the history below.",
        confirmLabel: "Remove",
        tone: "danger",
      });
      if (!ok) return;
    }
    setError(null);
    setSaving(true);
    const r = await apiPost("/api/stock-book-move", {
      action,
      mode,
      indent_ids: indentIds ? indentIds.split(",").map(Number) : [],
      book_id: fromStockBook,
      page: fromPage,
      to_indent_book: toIndentBook,
      to_indent_no: toIndentNo,
      to_indent_date: toIndentDate,
      to_book_id: toStockBook,
      to_page_no: toPage,
      moved_date: movedDate,
      moved_by: movedBy,
      remarks,
      lines: chosen.map(([k, qty]) => {
        const [kind, id] = k.split(":");
        return { kind, id: Number(id), qty };
      }),
    });
    setSaving(false);
    if (r.success) {
      toast.success(r.message);
      setRemarks("");
      setReloadKey((k) => k + 1);
      router.refresh();
    } else {
      // Kept beside the form: the fix is usually in one of its fields.
      setError(r.message);
    }
  };

  const emptyText =
    mode === "PAGE"
      ? "Nothing is entered on this page."
      : multiIndent
        ? "These indents have no items."
        : "This indent has no items.";
  const cols = 5 + (showIndentCol ? 1 : 0) + (mode === "PAGE" ? 1 : 0) + (hasStockLines ? 1 : 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            {removing
              ? "Remove from Stock Book"
              : mode === "INDENT"
                ? "Move to Another Indent Book"
                : "Move to Another Stock Book"}
          </CardTitle>
          <span className="text-sm text-faint">
            {removing
              ? "Take indent items or stock entries out of their stock register"
              : mode === "INDENT"
                ? "Move indent items onto an indent in a different indent book"
                : "Re-enter the entries on a stock book page in a different stock book"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Action">
          {ACTIONS.map((a) => (
            <Button
              key={a.value}
              type="button"
              size="sm"
              role="radio"
              aria-checked={action === a.value}
              variant={action === a.value ? (a.value === "REMOVE" ? "danger" : "primary") : "outline"}
              onClick={() => switchAction(a.value)}
            >
              <a.icon className="h-4 w-4" />
              {a.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
              {error}
            </div>
          )}

          <FormSection title="From" className="space-y-4">
            <div className="flex gap-2" role="radiogroup" aria-label="Pick entries by">
              {MODES.map((m) => (
                <Button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.value}
                  variant={mode === m.value ? "soft" : "outline"}
                  title={m.hint}
                  onClick={() => switchMode(m.value)}
                >
                  {m.label}
                </Button>
              ))}
            </div>

            {mode === "INDENT" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div>
                  <Label htmlFor="from-indent-book">
                    Indent Book <span className="text-red-500">*</span>
                  </Label>
                  <SearchableSelect
                    id="from-indent-book"
                    value={fromIndentBook}
                    onChange={(v) => {
                      setFromIndentBook(v);
                      setIndentIds("");
                    }}
                    options={indentBookOpts}
                    placeholder="Choose an indent book"
                  />
                </div>
                <div>
                  <Label htmlFor="indent">
                    Indent No / Date <span className="text-red-500">*</span>
                    {indentIds && (
                      <span className="ml-2 font-normal text-faint">
                        {indentIds.split(",").length} selected
                      </span>
                    )}
                  </Label>
                  <SearchableSelect
                    id="indent"
                    multiple
                    value={indentIds}
                    onChange={setIndentIds}
                    options={indentOpts}
                    disabled={!fromIndentBook}
                    placeholder={fromIndentBook ? "Choose one or more indents" : "Choose an indent book first"}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="from-stock-book">
                    Stock Book <span className="text-red-500">*</span>
                  </Label>
                  <SearchableSelect
                    id="from-stock-book"
                    value={fromStockBook}
                    onChange={(v) => {
                      setFromStockBook(v);
                      setFromPage("");
                    }}
                    options={stockBookOpts}
                    placeholder="Choose a stock book"
                  />
                </div>
                <div>
                  <Label htmlFor="from-page">
                    Page No <span className="text-red-500">*</span>
                  </Label>
                  <SearchableSelect
                    id="from-page"
                    value={fromPage}
                    onChange={setFromPage}
                    options={pageOpts}
                    disabled={!fromStockBook}
                    placeholder={
                      !fromStockBook
                        ? "Choose a stock book first"
                        : pageOpts.length
                          ? "Choose a page"
                          : "Nothing is entered in this book"
                    }
                  />
                </div>
              </div>
            )}

            {query && (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="data-grid">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-accent"
                          checked={allPicked}
                          onChange={toggleAll}
                          disabled={pickable.length === 0}
                          aria-label="Tick every item"
                        />
                      </th>
                      {mode === "PAGE" && <th>Type</th>}
                      {showIndentCol && <th>Indent No / Date</th>}
                      <th>Item</th>
                      {hasStockLines && <th>Entry Date</th>}
                      <th>{mode === "PAGE" ? "Page" : "Current Stock Book"}</th>
                      <th className="text-right">Qty</th>
                      <th className="w-32">{removing ? "Qty to Remove" : "Qty to Move"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(loading || loadError || lines.length === 0) && (
                      <tr>
                        <td colSpan={cols}>
                          <div className="flex flex-col items-center gap-2 py-8 text-center">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-faint ring-1 ring-line">
                              <Inbox className="h-5 w-5" />
                            </span>
                            <p className={`text-sm ${loadError ? "text-red-500" : "text-muted"}`}>
                              {loading ? "Loading entries…" : (loadError ?? emptyText)}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      lines.map((l) => {
                        const k = keyOf(l);
                        const on = k in picked;
                        const can = canAct(l, action);
                        return (
                          <tr key={k} className={can ? undefined : "opacity-50"}>
                            <td>
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-accent"
                                checked={on}
                                disabled={!can}
                                onChange={() => toggle(l)}
                                title={can ? undefined : "Not entered in any stock book"}
                                aria-label={`${removing ? "Remove" : "Move"} ${l.item_name}`}
                              />
                            </td>
                            {mode === "PAGE" && (
                              <td>
                                <Badge
                                  value={l.kind === "STOCK" ? "STOCK_ENTRY" : "INDENT_ITEM"}
                                  label={l.kind === "STOCK" ? "Stock entry" : "Indent item"}
                                />
                              </td>
                            )}
                            {showIndentCol && (
                              <td className="whitespace-nowrap">
                                <span className="block font-medium text-fg">{l.indent_no ?? "—"}</span>
                                <span className="block text-xs text-faint">
                                  {l.indent_date ? formatDate(l.indent_date) : "No indent"}
                                </span>
                              </td>
                            )}
                            <td>
                              <span className="block font-medium text-fg">{l.item_name}</span>
                              {l.group_name && <span className="block text-xs text-faint">{l.group_name}</span>}
                            </td>
                            {hasStockLines && (
                              <td className="whitespace-nowrap text-muted">
                                {l.entry_date ? formatDate(l.entry_date) : "—"}
                              </td>
                            )}
                            <td className={l.book_name ? "text-muted" : "text-faint"}>
                              {mode === "PAGE"
                                ? l.page_no != null
                                  ? `Page ${l.page_no}`
                                  : "No page number"
                                : bookAndPage(l.book_name, l.page_no)}
                            </td>
                            <td className="num text-right text-fg">{l.qty}</td>
                            <td>
                              <Input
                                type="number"
                                min={1}
                                max={l.qty}
                                className="h-8 w-24"
                                disabled={!on}
                                value={picked[k] ?? ""}
                                onChange={(e) => setPicked((prev) => ({ ...prev, [k]: e.target.value }))}
                                aria-label={`Quantity of ${l.item_name} to ${verb}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </FormSection>

          {!removing && (
            <FormSection title="To" className="space-y-3">
              {mode === "INDENT" ? (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <div>
                      <Label htmlFor="to-indent-book">
                        Indent Book <span className="text-red-500">*</span>
                      </Label>
                      <SearchableSelect
                        id="to-indent-book"
                        value={toIndentBook}
                        onChange={setToIndentBook}
                        options={indentBookOpts}
                        placeholder="Choose an indent book"
                      />
                    </div>
                    <div>
                      <Label htmlFor="to-indent-no">
                        Indent No <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="to-indent-no"
                        maxLength={50}
                        value={toIndentNo}
                        onChange={(e) => setToIndentNo(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="to-indent-date">
                        Indent Date <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="to-indent-date"
                        type="date"
                        value={toIndentDate}
                        onChange={(e) => setToIndentDate(e.target.value)}
                      />
                    </div>
                  </div>
                  {toIndentBook && toIndentNo.trim() && toIndentDate && (
                    <p className="flex items-center gap-2 text-xs text-muted">
                      <Info className="h-3.5 w-3.5 shrink-0 text-accent-fg" />
                      {targetIndent
                        ? `Items will be added to the existing Indent No ${toIndentNo.trim()} (${formatDate(toIndentDate)}) in ${toIndentBookName}.`
                        : `A new Indent No ${toIndentNo.trim()} dated ${formatDate(toIndentDate)} will be created in ${toIndentBookName}.`}
                    </p>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <div>
                    <Label htmlFor="to-book">
                      Stock Book <span className="text-red-500">*</span>
                    </Label>
                    <SearchableSelect
                      id="to-book"
                      value={toStockBook}
                      onChange={setToStockBook}
                      options={stockBookOpts}
                      placeholder="Choose a stock book"
                    />
                  </div>
                  <div>
                    <Label htmlFor="to-page">Page No</Label>
                    <Input
                      id="to-page"
                      type="number"
                      min={1}
                      value={toPage}
                      onChange={(e) => setToPage(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </FormSection>
          )}

          <FormSection title="Details" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="moved-date">
                {removing ? "Removed Date" : "Moved Date"} <span className="text-red-500">*</span>
              </Label>
              <Input id="moved-date" type="date" value={movedDate} onChange={(e) => setMovedDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="moved-by">
                {removing ? "Removed By" : "Moved By"} <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                id="moved-by"
                value={movedBy}
                onChange={setMovedBy}
                options={userOpts}
                placeholder="Choose a user"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Input id="remarks" maxLength={255} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </FormSection>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-faint">
              {removing
                ? "Indent items lose their stock book and page; stock entries are taken out of the stock book. Part of a quantity splits the line."
                : "Moving part of a quantity splits the line: the rest stays where it is."}
            </p>
            {removing ? (
              <Button type="submit" variant="danger" loading={saving}>
                <Trash2 className="h-4 w-4" />
                {saving ? "Removing…" : "Remove"}
              </Button>
            ) : (
              <Button type="submit" loading={saving}>
                <ArrowRightLeft className="h-4 w-4" />
                {saving ? "Moving…" : "Move"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
