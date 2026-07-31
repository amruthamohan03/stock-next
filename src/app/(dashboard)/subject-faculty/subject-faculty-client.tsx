"use client";

import { useMemo, useState } from "react";
import { Save, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";

export type SubjectOpt = { value: string; label: string };

type Faculty = {
  staff_id: number;
  staff_code: string | null;
  staff_name: string;
  designation: string | null;
  department_name: string | null;
  mapped: boolean;
};

export default function SubjectFacultyClient({ subjects }: { subjects: SubjectOpt[] }) {
  const [subjectId, setSubjectId] = useState("");
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadSubject = async (id: string) => {
    setSubjectId(id);
    setMsg(null);
    if (!id) {
      setFaculty([]);
      setChecked(new Set());
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/mappings/subject-faculty?subject_id=${id}`);
    const json = await res.json();
    setLoading(false);
    if (!json.success) {
      setMsg({ ok: false, text: json.message ?? "Failed to load" });
      return;
    }
    const rows = json.data as Faculty[];
    setFaculty(rows);
    setChecked(new Set(rows.filter((r) => r.mapped).map((r) => r.staff_id)));
  };

  const toggle = (id: number) =>
    setChecked((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return faculty;
    return faculty.filter((f) =>
      [f.staff_name, f.staff_code, f.designation, f.department_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [faculty, search]);

  const allChecked = filtered.length > 0 && filtered.every((f) => checked.has(f.staff_id));
  const toggleAll = () =>
    setChecked((s) => {
      const next = new Set(s);
      const target = !allChecked;
      for (const f of filtered) target ? next.add(f.staff_id) : next.delete(f.staff_id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/mappings/subject-faculty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_id: Number(subjectId), staff_ids: [...checked] }),
    });
    const json = await res.json();
    setSaving(false);
    setMsg({ ok: json.success, text: json.message ?? (json.success ? "Saved" : "Failed") });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subject → Faculty Mapping</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-72">
            <Label>Select Subject</Label>
            <SearchableSelect
              value={subjectId}
              onChange={loadSubject}
              placeholder="— Select Subject —"
              options={subjects}
            />
          </div>
          {faculty.length > 0 && (
            <>
              <Input
                placeholder="Search faculty…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-56"
              />
              <span className="pb-2 text-sm text-muted">
                {checked.size} selected of {faculty.length} faculty
              </span>
            </>
          )}
        </div>

        {msg && (
          <div
            className={`rounded-md px-3 py-2 text-sm ring-1 ${
              msg.ok
                ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20"
                : "bg-red-500/10 text-red-500 ring-red-500/20"
            }`}
          >
            {msg.text}
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-faint">Loading…</p>
        ) : !subjectId ? (
          <p className="py-8 text-center text-sm text-faint">
            Select a subject to assign faculty who can handle it.
          </p>
        ) : faculty.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line py-10 text-center text-sm text-faint">
            No teaching faculty found. Add staff with a teaching designation first.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-elevated text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="w-12 px-4 py-3 text-center font-semibold">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-brand-600"
                        checked={allChecked}
                        onChange={toggleAll}
                        title="Toggle all (visible)"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">Faculty</th>
                    <th className="px-4 py-3 font-semibold">Designation</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-faint">
                        No faculty match your search.
                      </td>
                    </tr>
                  )}
                  {filtered.map((f) => (
                    <tr
                      key={f.staff_id}
                      className="cursor-pointer border-b border-line/60 transition-colors hover:bg-accent-soft/40"
                      onClick={() => toggle(f.staff_id)}
                    >
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-brand-600"
                          checked={checked.has(f.staff_id)}
                          onChange={() => toggle(f.staff_id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-muted">{f.staff_code || "—"}</td>
                      <td className="px-4 py-2.5 font-medium text-fg">{f.staff_name}</td>
                      <td className="px-4 py-2.5 text-muted">{f.designation || "—"}</td>
                      <td className="px-4 py-2.5 text-muted">{f.department_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs text-faint">
                <Users className="h-3.5 w-3.5" /> Faculty = staff with a teaching designation
              </span>
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
