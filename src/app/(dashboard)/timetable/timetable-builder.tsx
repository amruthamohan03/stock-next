"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Coffee } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TableAction } from "@/components/ui/table-action";
import type { Opt } from "./options";

type SubjectOpt = { id: number; name: string; code: string | null };

export type PeriodInit = {
  label: string;
  start_time: string;
  end_time: string;
  fri_start_time?: string;
  fri_end_time?: string;
  is_break: boolean;
};
export type SlotInit = { day: string; period_no: number; subject_id: string; staff_id: string; batch: string };
export type TimetableInitial = {
  id: number;
  title: string;
  department_id: string;
  semester: string;
  scheme: string;
  academic_year: string;
  periods: PeriodInit[];
  slots: SlotInit[];
};

const DAYS = [
  { key: "MON", label: "Mon" },
  { key: "TUE", label: "Tue" },
  { key: "WED", label: "Wed" },
  { key: "THU", label: "Thu" },
  { key: "FRI", label: "Fri" },
];

type Period = {
  key: number;
  label: string;
  start: string;
  end: string;
  friStart: string;
  friEnd: string;
  isBreak: boolean;
};
type Slot = { subject_id: string; staff_id: string; batch: string };

const DEFAULT_PERIODS: Omit<Period, "key">[] = [
  { label: "1", start: "09:20", end: "10:15", friStart: "", friEnd: "", isBreak: false },
  { label: "2", start: "10:15", end: "11:10", friStart: "", friEnd: "", isBreak: false },
  { label: "3", start: "11:20", end: "12:15", friStart: "", friEnd: "", isBreak: false },
  { label: "Lunch", start: "12:15", end: "13:00", friStart: "12:50", friEnd: "14:00", isBreak: true },
  { label: "4", start: "13:00", end: "13:55", friStart: "", friEnd: "", isBreak: false },
  { label: "5", start: "13:55", end: "14:50", friStart: "", friEnd: "", isBreak: false },
  { label: "6", start: "14:50", end: "15:45", friStart: "", friEnd: "", isBreak: false },
];

const slotKey = (day: string, periodKey: number) => `${day}:${periodKey}`;

export default function TimetableBuilder({
  departments,
  subjects,
  faculty,
  initial,
  create = false,
}: {
  departments: Opt[];
  subjects: SubjectOpt[];
  faculty: Opt[];
  initial?: TimetableInitial;
  /** When true, prefill from `initial` but save as a NEW timetable (used by the
   *  auto-generated draft). */
  create?: boolean;
}) {
  const router = useRouter();
  const editing = !!initial && !create;
  const keyRef = useState(() => ({ n: 0 }))[0];

  const [title, setTitle] = useState(initial?.title ?? "");
  const [deptId, setDeptId] = useState(initial?.department_id ?? "");
  const [semester, setSemester] = useState(initial?.semester ?? "");
  const [scheme, setScheme] = useState(initial?.scheme ?? "");
  const [acYear, setAcYear] = useState(initial?.academic_year ?? "");

  const [periods, setPeriods] = useState<Period[]>(() => {
    if (initial?.periods.length) {
      return initial.periods.map((p) => ({
        key: keyRef.n++,
        label: p.label,
        start: p.start_time,
        end: p.end_time,
        friStart: p.fri_start_time ?? "",
        friEnd: p.fri_end_time ?? "",
        isBreak: p.is_break,
      }));
    }
    return DEFAULT_PERIODS.map((p) => ({ key: keyRef.n++, ...p }));
  });

  // Slots keyed by `${day}:${periodKey}`. On load, period keys are the row index,
  // matching the stored period_no.
  const [slots, setSlots] = useState<Record<string, Slot>>(() => {
    const o: Record<string, Slot> = {};
    for (const s of initial?.slots ?? []) {
      o[slotKey(s.day, s.period_no)] = {
        subject_id: s.subject_id,
        staff_id: s.staff_id,
        batch: s.batch,
      };
    }
    return o;
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const deptOpts = useMemo(() => departments.map((d) => ({ value: String(d.id), label: d.name })), [departments]);
  const subjectOpts = useMemo(() => subjects.map((s) => ({ value: String(s.id), label: s.name })), [subjects]);
  const facultyOpts = useMemo(() => faculty.map((f) => ({ value: String(f.id), label: f.name })), [faculty]);

  const setPeriod = (key: number, patch: Partial<Period>) =>
    setPeriods((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const addPeriod = (isBreak = false) =>
    setPeriods((ps) => [
      ...ps,
      {
        key: keyRef.n++,
        label: isBreak ? "Break" : String(ps.filter((p) => !p.isBreak).length + 1),
        start: "",
        end: "",
        friStart: "",
        friEnd: "",
        isBreak,
      },
    ]);
  const removePeriod = (key: number) => setPeriods((ps) => ps.filter((p) => p.key !== key));

  const setSlot = (day: string, periodKey: number, patch: Partial<Slot>) =>
    setSlots((s) => {
      const k = slotKey(day, periodKey);
      const cur = s[k] ?? { subject_id: "", staff_id: "", batch: "" };
      return { ...s, [k]: { ...cur, ...patch } };
    });

  const save = async () => {
    setMsg(null);
    if (!title.trim()) return setMsg({ ok: false, text: "Title is required." });
    if (periods.filter((p) => !p.isBreak).length === 0)
      return setMsg({ ok: false, text: "Add at least one class period." });

    // period_no = index in the periods array.
    const periodPayload = periods.map((p) => ({
      label: p.label,
      start_time: p.start,
      end_time: p.end,
      fri_start_time: p.friStart,
      fri_end_time: p.friEnd,
      is_break: p.isBreak,
    }));
    const slotPayload: SlotInit[] = [];
    periods.forEach((p, idx) => {
      if (p.isBreak) return;
      for (const d of DAYS) {
        const s = slots[slotKey(d.key, p.key)];
        if (s?.subject_id) {
          slotPayload.push({
            day: d.key,
            period_no: idx,
            subject_id: s.subject_id,
            staff_id: s.staff_id,
            batch: s.batch,
          });
        }
      }
    });

    setSaving(true);
    const res = await fetch("/api/timetable", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: initial?.id,
        title,
        department_id: deptId,
        semester,
        scheme,
        academic_year: acYear,
        periods: periodPayload,
        slots: slotPayload,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      router.push(`/timetable/${editing ? initial!.id : json.id}`);
      router.refresh();
    } else {
      setMsg({ ok: false, text: json.message ?? "Save failed" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Edit Timetable" : "Create Timetable"}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/timetable")}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : editing ? "Update" : "Save"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {msg && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ring-1 ${
                msg.ok ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20" : "bg-red-500/10 text-red-500 ring-red-500/20"
              }`}
            >
              {msg.text}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. S3 Computer Engineering — Odd Semester" />
            </div>
            <div>
              <Label>Department</Label>
              <SearchableSelect value={deptId} onChange={setDeptId} options={deptOpts} placeholder="Select" />
            </div>
            <div>
              <Label>Semester</Label>
              <Input value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="e.g. S3" />
            </div>
            <div>
              <Label>Scheme</Label>
              <Input value={scheme} onChange={(e) => setScheme(e.target.value)} placeholder="e.g. Revision 2021" />
            </div>
            <div>
              <Label>Academic Year</Label>
              <Input value={acYear} onChange={(e) => setAcYear(e.target.value)} placeholder="e.g. 2026-27" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period / break configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Periods &amp; Timings</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => addPeriod(false)}>
              <Plus className="h-4 w-4" /> Add Period
            </Button>
            <Button variant="outline" size="sm" onClick={() => addPeriod(true)}>
              <Coffee className="h-4 w-4" /> Add Break
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm" style={{ minWidth: "56rem" }}>
              <thead>
                <tr className="border-b border-line bg-elevated text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Label</th>
                  <th className="px-3 py-2 font-semibold">Start</th>
                  <th className="px-3 py-2 font-semibold">End</th>
                  <th className="px-3 py-2 font-semibold" title="Optional — overrides the time on Friday only">Fri Start</th>
                  <th className="px-3 py-2 font-semibold" title="Optional — overrides the time on Friday only">Fri End</th>
                  <th className="px-3 py-2 text-center font-semibold">Break?</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => (
                  <tr key={p.key} className={`border-b border-line/60 ${p.isBreak ? "bg-amber-500/5" : ""}`}>
                    <td className="px-3 py-2 text-faint">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Input value={p.label} onChange={(e) => setPeriod(p.key, { label: e.target.value })} className="h-8 w-24" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="time" value={p.start} onChange={(e) => setPeriod(p.key, { start: e.target.value })} className="h-8 w-28" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="time" value={p.end} onChange={(e) => setPeriod(p.key, { end: e.target.value })} className="h-8 w-28" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="time" value={p.friStart} onChange={(e) => setPeriod(p.key, { friStart: e.target.value })} className="h-8 w-28" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="time" value={p.friEnd} onChange={(e) => setPeriod(p.key, { friEnd: e.target.value })} className="h-8 w-28" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-brand-600"
                        checked={p.isBreak}
                        onChange={(e) => setPeriod(p.key, { isBreak: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <TableAction tone="delete" icon={Trash2} onClick={() => removePeriod(p.key)} title="Remove period" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Grid</CardTitle>
          <span className="text-xs text-faint">Mon–Fri · fill subject, faculty &amp; batch per class period</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: `${12 + periods.length * 12}rem` }}>
              <thead>
                <tr className="border-b border-line bg-elevated text-left text-[11px] text-muted">
                  <th className="border border-line px-2 py-2 font-semibold">Day \ Period</th>
                  {periods.map((p) => (
                    <th key={p.key} className={`border border-line px-2 py-2 font-semibold ${p.isBreak ? "bg-amber-500/10" : ""}`}>
                      <div>{p.isBreak ? p.label || "Break" : `P${p.label}`}</div>
                      <div className="font-normal text-faint">{[p.start, p.end].filter(Boolean).join("–")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => (
                  <tr key={d.key} className="align-top">
                    <td className="border border-line bg-elevated px-2 py-2 font-semibold text-fg">{d.label}</td>
                    {periods.map((p) =>
                      p.isBreak ? (
                        <td key={p.key} className="border border-line bg-amber-500/5 text-center align-middle text-[10px] font-medium uppercase tracking-wide text-amber-600">
                          Break
                        </td>
                      ) : (
                        <td key={p.key} className="border border-line px-1.5 py-1.5">
                          <div className="space-y-1">
                            <SearchableSelect
                              value={slots[slotKey(d.key, p.key)]?.subject_id ?? ""}
                              onChange={(v) => setSlot(d.key, p.key, { subject_id: v })}
                              options={subjectOpts}
                              placeholder="Subject"
                            />
                            <SearchableSelect
                              value={slots[slotKey(d.key, p.key)]?.staff_id ?? ""}
                              onChange={(v) => setSlot(d.key, p.key, { staff_id: v })}
                              options={facultyOpts}
                              placeholder="Faculty"
                            />
                            <Input
                              value={slots[slotKey(d.key, p.key)]?.batch ?? ""}
                              onChange={(e) => setSlot(d.key, p.key, { batch: e.target.value })}
                              placeholder="Batch (B1/B2)"
                              className="h-7 text-xs"
                            />
                          </div>
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Saving…" : editing ? "Update Timetable" : "Save Timetable"}
        </Button>
      </div>
    </div>
  );
}
