"use client";

import { useMemo, useState } from "react";
import { Boxes, Inbox, Layers, Search, Tags, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "../report/_components/report-ui";
import { useToast } from "@/components/ui/toast";
import { apiPost } from "@/lib/api-client";

export type MapItem = {
  id: number;
  item_name: string;
  item_code: string | null;
  category_name: string | null;
  group_id: number | null;
};
type Group = { id: number; name: string };

const PAGE_SIZE = 15;
/** Sentinel for the bulk picker's "take the group off these items" choice. */
const CLEAR = "clear";
/** Sentinel for the "show me only what still needs filing" filter. */
const UNGROUPED = "none";

export default function ItemGroupMapClient({
  rows: initial,
  groups,
}: {
  rows: MapItem[];
  groups: Group[];
}) {
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [search, setSearch] = useState("");
  /** "" = every item, "none" = ungrouped only, otherwise a group id. */
  const [groupFilter, setGroupFilter] = useState("");
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [bulkGroup, setBulkGroup] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const groupName = useMemo(() => {
    const m = new Map<number, string>();
    for (const g of groups) m.set(g.id, g.name);
    return m;
  }, [groups]);

  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: String(g.id), label: g.name })),
    [groups]
  );

  const ungrouped = useMemo(() => rows.filter((r) => r.group_id == null).length, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inFilter = (r: MapItem) => {
      if (groupFilter === "") return true;
      if (groupFilter === UNGROUPED) return r.group_id == null;
      return String(r.group_id) === groupFilter;
    };
    return rows.filter((r) => {
      if (!inFilter(r)) return false;
      if (!q) return true;
      return [r.item_name, r.item_code, r.category_name, groupName.get(r.group_id ?? -1)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, groupFilter, groupName]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  /** Search/filter changes must not leave the user stranded on a dead page. */
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const toggle = (id: number) =>
    setPicked((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => picked.has(r.id));
  const togglePage = () =>
    setPicked((s) => {
      const next = new Set(s);
      for (const r of pageRows) (allOnPage ? next.delete(r.id) : next.add(r.id));
      return next;
    });

  /** One shared save path: a row's own dropdown is just a selection of one. */
  const assign = async (itemIds: number[], groupId: number | null) => {
    const result = await apiPost("/api/mappings/item-group", {
      group_id: groupId,
      item_ids: itemIds,
    });
    if (!toast.fromResult(result)) return false;
    const ids = new Set(itemIds);
    setRows((rs) => rs.map((r) => (ids.has(r.id) ? { ...r, group_id: groupId } : r)));
    return true;
  };

  const setRowGroup = async (item: MapItem, value: string) => {
    const groupId = value ? Number(value) : null;
    if (groupId === item.group_id) return;
    setSavingId(item.id);
    await assign([item.id], groupId);
    setSavingId(null);
  };

  const applyBulk = async () => {
    if (picked.size === 0 || !bulkGroup) return;
    setBulkSaving(true);
    const ok = await assign([...picked], bulkGroup === CLEAR ? null : Number(bulkGroup));
    setBulkSaving(false);
    if (ok) {
      setPicked(new Set());
      setBulkGroup("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active items" value={rows.length} grad="grad-blue" />
        <StatCard label="Mapped to a group" value={rows.length - ungrouped} grad="grad-green" />
        <StatCard label="Ungrouped" value={ungrouped} grad="grad-amber" />
        <StatCard label="Item groups" value={groups.length} grad="grad-violet" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" /> Item ↔ Item Group Mapping
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            A group is the heading an item is reported under — the stock entry form&apos;s
            Group → Item dropdowns and every group filter on the reports only reach items
            that carry one. Set a group on a single row, or tick several rows and map them
            in one go.
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <Label htmlFor="igm-search">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <Input
                  id="igm-search"
                  className="pl-8"
                  placeholder="Item, code, category or group…"
                  value={search}
                  onChange={(e) => reset(() => setSearch(e.target.value))}
                />
              </div>
            </div>
            <div className="w-64">
              <Label>Show</Label>
              <SearchableSelect
                value={groupFilter}
                onChange={(v) => reset(() => setGroupFilter(v))}
                placeholder="All items"
                options={[
                  { value: "", label: "All items" },
                  { value: UNGROUPED, label: "Ungrouped only" },
                  ...groupOptions,
                ]}
              />
            </div>
            <span className="pb-2.5 text-sm text-muted tabular-nums">
              {filtered.length} of {rows.length} items
              {picked.size > 0 && ` · ${picked.size} ticked`}
            </span>
          </div>

          {picked.size > 0 && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-accent/30 bg-accent-soft/50 px-4 py-3">
              <span className="pb-2.5 text-sm font-medium text-fg">
                Map {picked.size} selected item{picked.size === 1 ? "" : "s"} to
              </span>
              <div className="w-64">
                <SearchableSelect
                  value={bulkGroup}
                  onChange={setBulkGroup}
                  placeholder="— Choose item group —"
                  options={[...groupOptions, { value: CLEAR, label: "— Clear group —" }]}
                />
              </div>
              <Button onClick={applyBulk} disabled={!bulkGroup} loading={bulkSaving}>
                <Wand2 className="h-4 w-4" /> Apply
              </Button>
              <Button variant="ghost" onClick={() => setPicked(new Set())}>
                Clear selection
              </Button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="data-grid">
              <thead>
                <tr>
                  <th className="w-12 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-brand-600"
                      checked={allOnPage}
                      onChange={togglePage}
                      title="Tick every item on this page"
                      aria-label="Tick every item on this page"
                    />
                  </th>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="w-72">Item Group</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <Inbox className="mx-auto mb-2 h-8 w-8 text-faint" />
                      <p className="text-sm text-muted">
                        {rows.length === 0
                          ? "No active items yet — add items in the Item master first."
                          : "No items match this search."}
                      </p>
                    </td>
                  </tr>
                )}
                {pageRows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-brand-600"
                        checked={picked.has(r.id)}
                        onChange={() => toggle(r.id)}
                        aria-label={`Select ${r.item_name}`}
                      />
                    </td>
                    <td>
                      <span className="font-medium text-fg">{r.item_name}</span>
                      {r.item_code && (
                        <span className="ml-2 text-xs text-faint">{r.item_code}</span>
                      )}
                    </td>
                    <td className="text-muted">{r.category_name || "—"}</td>
                    <td>
                      <SearchableSelect
                        value={r.group_id == null ? "" : String(r.group_id)}
                        onChange={(v) => setRowGroup(r, v)}
                        placeholder="— Ungrouped —"
                        options={[{ value: "", label: "— Ungrouped —" }, ...groupOptions]}
                        disabled={savingId === r.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPage={setPage}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-faint">
            <span className="inline-flex items-center gap-1.5">
              <Tags className="h-3.5 w-3.5" /> Groups come from the Item Group master
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5" /> Each item belongs to one group
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
