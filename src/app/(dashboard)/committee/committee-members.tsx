"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete, apiRequest } from "@/lib/api-client";
import {
  MEMBER_ROLES,
  MEMBER_ROLE_LABEL,
  MEMBER_ROLE_OPTIONS,
  MEMBER_ROLE_TINT,
  initialsOf,
  memberRoleRank,
  toMemberRole,
} from "@/lib/committee";

export type Member = {
  id: number;
  staff_id: number | null;
  member_name: string;
  designation: string | null;
  member_role: string;
  sort_order: number;
};

type Form = {
  id?: number;
  staff_id: string;
  member_name: string;
  designation: string;
  member_role: string;
  sort_order: string;
};

const blank = (role: string): Form => ({
  staff_id: "",
  member_name: "",
  designation: "",
  member_role: role,
  sort_order: "0",
});

/**
 * The people named in the appointment order, grouped by role in order of
 * seniority (Chairman → Convenor → Adviser → Secretary → Member → Student).
 */
export default function CommitteeMembers({
  committeeId,
  members,
  staff,
  designations,
}: {
  committeeId: number;
  members: Member[];
  staff: { value: string; label: string; designation: string }[];
  /** Designation names from the master (src/app/(dashboard)/designation). */
  designations: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank("MEMBER"));

  /**
   * Designation options from the master, plus whatever this member already has
   * if the master does not list it. Without that fallback a legacy or
   * staff-copied designation would render as the placeholder and be silently
   * wiped on the next save, because SearchableSelect resolves its label by
   * looking the value up in the options.
   */
  const designationOptions = useMemo(() => {
    const opts = [
      { value: "", label: "— None —" },
      ...designations.map((d) => ({ value: d, label: d })),
    ];
    const current = form.designation.trim();
    if (current && !designations.includes(current)) {
      opts.push({ value: current, label: `${current} (not in master)` });
    }
    return opts;
  }, [designations, form.designation]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Seniority first, then the row's own ordering, then name.
  const grouped = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const m of [...members].sort(
      (a, b) =>
        memberRoleRank(a.member_role) - memberRoleRank(b.member_role) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.member_name.localeCompare(b.member_name)
    )) {
      const role = toMemberRole(m.member_role);
      map.set(role, [...(map.get(role) ?? []), m]);
    }
    return MEMBER_ROLES.filter((r) => map.has(r)).map((r) => [r, map.get(r)!] as const);
  }, [members]);

  const openAdd = (role = "MEMBER") => {
    setForm(blank(role));
    setError(null);
    setOpen(true);
  };

  const openEdit = (m: Member) => {
    setForm({
      id: m.id,
      staff_id: m.staff_id ? String(m.staff_id) : "",
      member_name: m.member_name,
      designation: m.designation ?? "",
      member_role: toMemberRole(m.member_role),
      sort_order: String(m.sort_order ?? 0),
    });
    setError(null);
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.staff_id && !form.member_name.trim()) {
      setError("Pick a staff member, or type a name.");
      return;
    }
    setBusy(true);
    const result = await apiRequest("/api/committee/member", {
      method: form.id ? "PUT" : "POST",
      body: { ...form, committee_id: committeeId },
    });
    setBusy(false);
    if (result.success) {
      setOpen(false);
      toast.success(result.message || "Saved");
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  const remove = async (m: Member) => {
    const ok = await confirm({
      title: `Remove ${m.member_name}?`,
      description: `They are listed as ${MEMBER_ROLE_LABEL[toMemberRole(m.member_role)]}.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    const result = await apiDelete(`/api/committee/member?id=${m.id}`);
    if (toast.fromResult(result, { success: "Member removed" })) router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {members.length === 0
            ? "Nobody has been added yet."
            : `${members.length} ${members.length === 1 ? "person" : "people"} named in the order`}
        </p>
        <Button size="sm" onClick={() => openAdd()}>
          <UserPlus className="h-4 w-4" /> Add member
        </Button>
      </div>

      {members.length === 0 ? (
        <button
          type="button"
          onClick={() => openAdd("CONVENOR")}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-elevated/50 px-4 py-10 text-sm text-muted transition-colors hover:border-accent hover:text-fg"
        >
          <UserPlus className="h-7 w-7" />
          <span className="font-medium">Add the first member</span>
          <span className="text-xs text-faint">Start with the convenor or chairman</span>
        </button>
      ) : (
        <div className="space-y-5">
          {grouped.map(([role, list]) => (
            <div key={role}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${MEMBER_ROLE_TINT[role]}`}
                >
                  {MEMBER_ROLE_LABEL[role]}
                </span>
                <span className="text-xs text-faint">{list.length}</span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {list.map((m) => (
                  <div
                    key={m.id}
                    className="group flex items-center gap-3 rounded-xl border border-line bg-card p-3 transition-colors hover:border-accent/40"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-inset ${MEMBER_ROLE_TINT[role]}`}
                      aria-hidden="true"
                    >
                      {initialsOf(m.member_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium break-words text-fg">{m.member_name}</div>
                      <div
                        className="truncate text-xs text-muted"
                        title={m.designation || MEMBER_ROLE_LABEL[role]}
                      >
                        {m.designation || MEMBER_ROLE_LABEL[role]}
                        {m.staff_id ? "" : " · external"}
                      </div>
                    </div>
                    {/* Dimmed rather than hidden — hover-only actions cannot be
                        reached on a touch screen. */}
                    <div className="shrink-0 opacity-60 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <TableActions>
                        <TableAction tone="edit" icon={Pencil} onClick={() => openEdit(m)} title="Edit" />
                        <TableAction tone="delete" icon={Trash2} onClick={() => remove(m)} title="Remove" />
                      </TableActions>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Edit member" : "Add member"}
      >
        <form onSubmit={save} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Staff member</Label>
              <SearchableSelect
                value={form.staff_id}
                onChange={(v) => {
                  const picked = staff.find((s) => s.value === v);
                  setForm((f) => ({
                    ...f,
                    staff_id: v,
                    // Only fill a blank designation — never overwrite one the
                    // user has deliberately chosen for this committee.
                    designation: f.designation || picked?.designation || "",
                  }));
                }}
                options={staff}
                placeholder="Select from the staff register…"
              />
              <p className="mt-1 text-xs text-faint">
                Picking a staff member copies their name and designation.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label>Or type a name</Label>
              <Input
                value={form.member_name}
                onChange={(e) => setForm({ ...form, member_name: e.target.value })}
                placeholder="For a student or an external member"
              />
            </div>
            <div>
              <Label>Role</Label>
              <SearchableSelect
                value={form.member_role}
                onChange={(v) => setForm({ ...form, member_role: v })}
                options={MEMBER_ROLE_OPTIONS}
              />
            </div>
            <div>
              <Label>Designation</Label>
              <SearchableSelect
                value={form.designation}
                onChange={(v) => setForm({ ...form, designation: v })}
                options={designationOptions}
                placeholder="Select designation…"
              />
            </div>
            <div>
              <Label>Order within role</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              <Plus className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
