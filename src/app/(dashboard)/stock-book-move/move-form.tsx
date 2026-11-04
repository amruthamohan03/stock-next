"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Inbox, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiPost, apiRequest } from "@/lib/api-client";
import { stockBookLabel } from "@/lib/stock-books";
import { formatDate } from "@/lib/utils";
import type { MoveLine } from "@/lib/stock-book-move";

type Source = "INDENT" | "STOCK";
type Action = "MOVE" | "REMOVE";

const ACTIONS: { value: Action; label: string; icon: typeof Trash2 }[] = [
  { value: "MOVE", label: "Move to another book", icon: ArrowRightLeft },
  { value: "REMOVE", label: "Remove from stock book", icon: Trash2 },
];

const SOURCES: { value: Source; label: string; hint: string }[] = [
  { value: "INDENT", label: "Indent entry", hint: "Items written on the indent" },
  { value: "STOCK", label: "Stock entry", hint: "Stock received against the indent" },
];

const today = () => new Date().toISOString().slice(0, 10);

const bookAndPage = (book: string | null, page: number | null) =>
  book ? `${book}${page != null ? ` (Page No: ${page})` : ""}` : "No stock book";

export default function MoveForm({
  indents,
  stockBooks,
  users,
  currentUserId,
}: {
  indents: { id: number; indent_no: string | null; indent_date: string | null; book_name: string | null }[];
  stockBooks: { id: number; name: string; book_no: number | null; volume: number | null }[];
  users: { id: number; name: string }[];
  currentUserId: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [action, setAction] = useState<Action>("MOVE");
  const removing = action === "REMOVE";
  const verb = removing ? "remove" : "move";
  const [source, setSource] = useState<Source>("INDENT");
  /** Chosen indents, comma separated (the multi-select's value format). */
  const [indentIds, setIndentIds] = useState("");
  const indentCount = indentIds ? indentIds.split(",").length : 0;
  // With several indents the item table says which one each line is from.
  const multi = indentCount > 1;
  const [lines, setLines] = useState<MoveLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Ticked lines: line id → quantity to move (as typed). */
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [toBook, setToBook] = useState("");
  const [toPage, setToPage] = useState("");
  const [movedDate, setMovedDate] = useState(today);
  const [movedBy, setMovedBy] = useState(currentUserId ? String(currentUserId) : "");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const indentOpts = useMemo(
    () =>
      indents.map((i) => ({
        value: String(i.id),
        label: [
          `Indent No ${i.indent_no ?? i.id}`,
          i.indent_date ? formatDate(i.indent_date) : null,
          i.book_name,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [indents]
  );
  const bookOpts = useMemo(
    () => stockBooks.map((b) => ({ value: String(b.id), label: stockBookLabel(b) })),
    [stockBooks]
  );
  const userOpts = useMemo(
    () => users.map((u) => ({ value: String(u.id), label: u.name })),
    [users]
  );

  // Load the chosen indent's lines whenever the indent or the source changes.
  useEffect(() => {
    setPicked({});
    setLines([]);
    setLoadError(null);
    if (!indentIds) return;
    let stale = false;
    setLoading(true);
    // `data` is the whole response body; the lines sit in its own `data` field.
    apiRequest<{ data?: MoveLine[] }>(
      `/api/stock-book-move?source=${source}&indent_ids=${indentIds}`
    ).then((result) => {
      if (stale) return;
      setLoading(false);
      if (result.success) setLines(result.data?.data ?? []);
      else setLoadError(result.message);
    });
    return () => {
      stale = true;
    };
  }, [source, indentIds, reloadKey]);

  const toggle = (line: MoveLine) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (line.id in next) delete next[line.id];
      else next[line.id] = String(line.qty);
      return next;
    });

  // Only a line that sits in a stock book can be taken out of one.
  const selectable = (l: MoveLine) => !removing || l.book_id !== null;
  const pickable = lines.filter(selectable);
  const allPicked = pickable.length > 0 && pickable.every((l) => l.id in picked);

  // Selected indents that contributed no lines, so they don't silently vanish.
  const emptyIndents = useMemo(() => {
    if (loading || loadError || !indentIds) return [];
    const have = new Set(lines.map((l) => String(l.indent_id)));
    return indentIds
      .split(",")
      .filter((id) => !have.has(id))
      .map((id) => indentOpts.find((o) => o.value === id)?.label ?? `Indent #${id}`);
  }, [loading, loadError, indentIds, lines, indentOpts]);
  const toggleAll = () =>
    setPicked(allPicked ? {} : Object.fromEntries(pickable.map((l) => [l.id, String(l.qty)])));

  const switchAction = (next: Action) => {
    setAction(next);
    setError(null);
    // Drop ticks that the new action can't act on.
    if (next === "REMOVE")
      setPicked((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([id]) => lines.find((l) => l.id === Number(id))?.book_id != null)
        )
      );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = Object.entries(picked);
    const check =
      !indentIds
        ? "Choose at least one indent."
        : chosen.length === 0
          ? `Tick at least one item to ${verb}.`
          : !removing && !toBook
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
    if (
      removing &&
      !(await confirm({
        title: `Remove ${chosen.length} ${chosen.length === 1 ? "item" : "items"} from the stock book?`,
        description:
          "They will no longer be entered in any stock book. The removal is kept in the history below.",
        confirmLabel: "Remove",
        tone: "danger",
      }))
    )
      return;
    setError(null);
    setSaving(true);
    const result = await apiPost("/api/stock-book-move", {
      action,
      source,
      indent_ids: indentIds.split(",").map(Number),
      to_book_id: toBook,
      to_page_no: toPage,
      moved_date: movedDate,
      moved_by: movedBy,
      remarks,
      lines: chosen.map(([id, qty]) => ({ id: Number(id), qty })),
    });
    setSaving(false);
    if (result.success) {
      toast.success(result.message);
      setToPage("");
      setRemarks("");
      setReloadKey((k) => k + 1);
      router.refresh();
    } else {
      // Kept beside the form: the fix is usually in one of its fields.
      setError(result.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{removing ? "Remove from Stock Book" : "Move to Another Stock Book"}</CardTitle>
          <span className="text-sm text-faint">
            {removing
              ? "Take indent items or stock entries out of their stock register"
              : "Re-enter indent items or stock entries in a different stock register"}
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
        <form onSubmit={submit} className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
            <div>
              <Label>From</Label>
              <div className="flex gap-2" role="radiogroup" aria-label="What to act on">
                {SOURCES.map((s) => (
                  <Button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={source === s.value}
                    variant={source === s.value ? "soft" : "outline"}
                    title={s.hint}
                    onClick={() => setSource(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="indent">
                Indent No / Date <span className="text-red-500">*</span>
                {indentCount > 0 && (
                  <span className="ml-2 font-normal text-faint">{indentCount} selected</span>
                )}
              </Label>
              <SearchableSelect
                id="indent"
                multiple
                value={indentIds}
                onChange={setIndentIds}
                options={indentOpts}
                placeholder="Choose one or more indents"
              />
            </div>
          </div>

          {indentIds && (
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
                    {multi && <th>Indent No / Date</th>}
                    <th>Item</th>
                    {source === "STOCK" && <th>Entry Date</th>}
                    <th>Current Stock Book</th>
                    <th className="text-right">Qty</th>
                    <th className="w-32">{removing ? "Qty to Remove" : "Qty to Move"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(loading || loadError || lines.length === 0) && (
                    <tr>
                      <td colSpan={5 + (source === "STOCK" ? 1 : 0) + (multi ? 1 : 0)}>
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-faint ring-1 ring-line">
                            <Inbox className="h-5 w-5" />
                          </span>
                          <p className={`text-sm ${loadError ? "text-red-500" : "text-muted"}`}>
                            {loading
                              ? "Loading items…"
                              : loadError
                                ? loadError
                                : source === "STOCK"
                                  ? `No stock has been entered against ${multi ? "these indents" : "this indent"}.`
                                  : `${multi ? "These indents have" : "This indent has"} no items.`}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    lines.map((l) => {
                      const on = l.id in picked;
                      const can = selectable(l);
                      return (
                        <tr key={l.id} className={can ? undefined : "opacity-50"}>
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
                          {multi && (
                            <td className="whitespace-nowrap">
                              <span className="block font-medium text-fg">{l.indent_no ?? "—"}</span>
                              <span className="block text-xs text-faint">
                                {l.indent_date ? formatDate(l.indent_date) : "—"}
                              </span>
                            </td>
                          )}
                          <td>
                            <span className="block font-medium text-fg">{l.item_name}</span>
                            {l.group_name && (
                              <span className="block text-xs text-faint">{l.group_name}</span>
                            )}
                          </td>
                          {source === "STOCK" && (
                            <td className="whitespace-nowrap text-muted">
                              {l.entry_date ? formatDate(l.entry_date) : "—"}
                            </td>
                          )}
                          <td className={l.book_name ? "text-muted" : "text-faint"}>
                            {bookAndPage(l.book_name, l.page_no)}
                          </td>
                          <td className="num text-right text-fg">{l.qty}</td>
                          <td>
                            <Input
                              type="number"
                              min={1}
                              max={l.qty}
                              className="h-8 w-24"
                              disabled={!on}
                              value={picked[l.id] ?? ""}
                              onChange={(e) =>
                                setPicked((prev) => ({ ...prev, [l.id]: e.target.value }))
                              }
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
          {multi && emptyIndents.length > 0 && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-600 ring-1 ring-amber-500/25 dark:text-amber-400">
              {source === "STOCK" ? "No stock entered against" : "No items on"}{" "}
              {emptyIndents.length === 1 ? "this selected indent" : "these selected indents"}:{" "}
              <span className="font-medium">{emptyIndents.join("; ")}</span>
              {source === "STOCK" && " — switch to Indent entry to move their indent items."}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {!removing && (
              <>
                <div className="sm:col-span-2">
                  <Label htmlFor="to-book">
                    Move to Stock Book <span className="text-red-500">*</span>
                  </Label>
                  <SearchableSelect
                    id="to-book"
                    value={toBook}
                    onChange={setToBook}
                    options={bookOpts}
                    placeholder="Choose a stock book"
                  />
                </div>
                <div>
                  <Label htmlFor="to-page">Page No in New Book</Label>
                  <Input
                    id="to-page"
                    type="number"
                    min={1}
                    value={toPage}
                    onChange={(e) => setToPage(e.target.value)}
                  />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="moved-date">
                {removing ? "Removed Date" : "Moved Date"} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="moved-date"
                type="date"
                value={movedDate}
                onChange={(e) => setMovedDate(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
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
              <Input
                id="remarks"
                maxLength={255}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-faint">
              {removing ? "Removing" : "Moving"} part of a quantity splits the line: the rest
              stays in its current book.
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
