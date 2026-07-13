"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";

type Role = { id: number; role_name: string };

const PERMS = ["view", "add", "edit", "delete", "approve"] as const;
type Perm = (typeof PERMS)[number];

type MenuRow = {
  menu_id: number;
  menu_name: string;
  can_view: number;
  can_add: number;
  can_edit: number;
  can_delete: number;
  can_approve: number;
};

// { [menu_id]: { view, add, edit, delete, approve } }
type PermState = Record<number, Record<Perm, boolean>>;

export default function RoleMenuClient({ roles }: { roles: Role[] }) {
  const [roleId, setRoleId] = useState("");
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [perms, setPerms] = useState<PermState>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadRole = async (id: string) => {
    setRoleId(id);
    setMsg(null);
    if (!id) {
      setMenus([]);
      setPerms({});
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/mappings/role-menu?role_id=${id}`);
    const json = await res.json();
    setLoading(false);
    if (!json.success) {
      setMsg({ ok: false, text: json.message ?? "Failed to load" });
      return;
    }
    const rows = json.data as MenuRow[];
    setMenus(rows);
    const state: PermState = {};
    for (const r of rows) {
      state[r.menu_id] = {
        view: !!r.can_view,
        add: !!r.can_add,
        edit: !!r.can_edit,
        delete: !!r.can_delete,
        approve: !!r.can_approve,
      };
    }
    setPerms(state);
  };

  const toggle = (menuId: number, perm: Perm) =>
    setPerms((s) => ({
      ...s,
      [menuId]: { ...s[menuId], [perm]: !s[menuId]?.[perm] },
    }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? menus.filter((m) => m.menu_name.toLowerCase().includes(q)) : menus;
  }, [menus, search]);

  // Toggle a whole permission column (over the visible rows).
  const allInColumn = (perm: Perm) =>
    filtered.length > 0 && filtered.every((m) => perms[m.menu_id]?.[perm]);
  const toggleColumn = (perm: Perm) => {
    const next = !allInColumn(perm);
    setPerms((s) => {
      const copy = { ...s };
      for (const m of filtered) copy[m.menu_id] = { ...copy[m.menu_id], [perm]: next };
      return copy;
    });
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const rows = menus.map((m) => ({ menu_id: m.menu_id, ...perms[m.menu_id] }));
    const res = await fetch("/api/mappings/role-menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_id: Number(roleId), rows }),
    });
    const json = await res.json();
    setSaving(false);
    setMsg({ ok: json.success, text: json.message ?? (json.success ? "Saved" : "Failed") });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role → Menu Mapping</CardTitle>
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
          {menus.length > 0 && (
            <Input
              placeholder="Search menus…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56"
            />
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
            Select a role to load its menu permissions.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-medium">Menu</th>
                    {PERMS.map((p) => (
                      <th key={p} className="px-4 py-3 text-center font-medium">
                        <button
                          type="button"
                          onClick={() => toggleColumn(p)}
                          className="capitalize underline-offset-2 hover:text-brand-600 hover:underline"
                          title={`Toggle all ${p}`}
                        >
                          {p}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No menus found.
                      </td>
                    </tr>
                  )}
                  {filtered.map((m) => (
                    <tr key={m.menu_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-slate-700">{m.menu_name}</td>
                      {PERMS.map((p) => (
                        <td key={p} className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-brand-600"
                            checked={!!perms[m.menu_id]?.[p]}
                            onChange={() => toggle(m.menu_id, p)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
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
