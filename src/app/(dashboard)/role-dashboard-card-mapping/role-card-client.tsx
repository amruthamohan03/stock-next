"use client";

import { useMemo, useState } from "react";
import { Check, Save, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";

type Role = { id: number; role_name: string };

type CardRow = {
  card_id: number;
  card_key: string;
  card_title: string;
  card_subtitle: string | null;
  card_icon: string | null;
  card_color: string | null;
  card_category: string | null;
  menu_id: number;
  menu_name: string;
  is_mapped: number;
};

export default function RoleCardClient({ roles }: { roles: Role[] }) {
  const [roleId, setRoleId] = useState("");
  const [cards, setCards] = useState<CardRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyFrom, setCopyFrom] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadRole = async (id: string) => {
    setRoleId(id);
    setMsg(null);
    if (!id) {
      setCards([]);
      setSelected(new Set());
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/mappings/role-dashboard-card?role_id=${id}`);
    const json = await res.json();
    setLoading(false);
    if (!json.success) {
      setMsg({ ok: false, text: json.message ?? "Failed to load" });
      return;
    }
    const rows = json.data as CardRow[];
    setCards(rows);
    setSelected(new Set(rows.filter((c) => c.is_mapped).map((c) => c.card_id)));
  };

  const toggle = (cardId: number) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(cardId) ? next.delete(cardId) : next.add(cardId);
      return next;
    });

  // Group cards by page (menu_name) for display.
  const groups = useMemo(() => {
    const g = new Map<string, CardRow[]>();
    for (const c of cards) {
      const list = g.get(c.menu_name) ?? [];
      list.push(c);
      g.set(c.menu_name, list);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [cards]);

  const selectAll = () => setSelected(new Set(cards.map((c) => c.card_id)));
  const deselectAll = () => setSelected(new Set());

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/mappings/role-dashboard-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_id: Number(roleId), card_ids: [...selected] }),
    });
    const json = await res.json();
    setSaving(false);
    setMsg({ ok: json.success, text: json.message ?? (json.success ? "Saved" : "Failed") });
  };

  const doCopy = async () => {
    if (!copyFrom || !roleId) return;
    setMsg(null);
    const res = await fetch("/api/mappings/role-dashboard-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "copy",
        source_role_id: Number(copyFrom),
        target_role_id: Number(roleId),
      }),
    });
    const json = await res.json();
    if (json.success) {
      await loadRole(roleId); // refresh selection from the copied mapping
      setMsg({ ok: true, text: json.message });
    } else {
      setMsg({ ok: false, text: json.message ?? "Copy failed" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role → Dashboard Card Mapping</CardTitle>
        {cards.length > 0 && (
          <span className="text-sm text-slate-500">
            {selected.size} / {cards.length} cards selected
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Label>Select Role</Label>
            <SearchableSelect
              value={roleId}
              onChange={loadRole}
              placeholder="— Select Role —"
              options={roles.map((r) => ({ value: r.id, label: r.role_name }))}
            />
          </div>
          {roleId && cards.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select all
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect all
              </Button>
            </div>
          )}
          {roleId && (
            <div className="ml-auto flex items-end gap-2">
              <div className="w-52">
                <Label>Copy from role</Label>
                <SearchableSelect
                  value={copyFrom}
                  onChange={setCopyFrom}
                  placeholder="— Source role —"
                  options={roles
                    .filter((r) => String(r.id) !== roleId)
                    .map((r) => ({ value: r.id, label: r.role_name }))}
                />
              </div>
              <Button variant="outline" size="sm" onClick={doCopy} disabled={!copyFrom}>
                <Copy className="h-4 w-4" /> Copy
              </Button>
            </div>
          )}
        </div>

        {msg && (
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {msg.text}
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : !roleId ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Select a role to load dashboard cards.
          </p>
        ) : cards.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No dashboard cards found.</p>
        ) : (
          <>
            <div className="space-y-5">
              {groups.map(([menuName, list]) => (
                <div key={menuName}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">{menuName}</h3>
                    <span className="text-xs text-slate-400">
                      {list.filter((c) => selected.has(c.card_id)).length} / {list.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((c) => {
                      const on = selected.has(c.card_id);
                      return (
                        <button
                          key={c.card_id}
                          type="button"
                          onClick={() => toggle(c.card_id)}
                          className={cn(
                            "relative flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                            on
                              ? "border-emerald-400 bg-emerald-50/60"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                              on
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-slate-300"
                            )}
                          >
                            {on && <Check className="h-3 w-3" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-700">
                              {c.card_title}
                            </span>
                            <span className="block truncate text-xs text-slate-400">
                              {c.card_subtitle || c.card_key}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button onClick={save} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Mapping"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
