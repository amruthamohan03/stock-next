"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import TimetableBuilder, { type TimetableInitial } from "../../timetable-builder";
import type { Opt } from "../../options";

export type ClassOpt = {
  value: string;
  label: string;
  department_id: number;
  department_name: string;
  semester: string;
  scheme: string;
};

type Options = { departments: Opt[]; subjects: { id: number; name: string; code: string | null }[]; faculty: Opt[] };

export default function AutoTimetable({ options, classes }: { options: Options; classes: ClassOpt[] }) {
  const router = useRouter();
  const [cls, setCls] = useState("");
  const [title, setTitle] = useState("");
  const [acYear, setAcYear] = useState("");
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<TimetableInitial | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const classOpts = classes.map((c) => ({ value: c.value, label: c.label }));

  const generate = async () => {
    setMsg(null);
    const chosen = classes.find((c) => c.value === cls);
    if (!chosen) return setMsg("Pick a class to schedule.");

    setGenerating(true);
    const res = await fetch("/api/timetable/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        department_id: chosen.department_id,
        semester: chosen.semester,
        scheme: chosen.scheme,
      }),
    });
    const json = await res.json();
    setGenerating(false);
    if (!json.success) return setMsg(json.message ?? "Could not generate");

    setWarnings(json.data.warnings ?? []);
    setDraft({
      id: 0,
      title: title.trim() || `${chosen.semester} ${chosen.department_name} — Timetable`,
      department_id: String(chosen.department_id),
      semester: chosen.semester,
      scheme: chosen.scheme,
      academic_year: acYear,
      periods: json.data.periods,
      slots: json.data.slots,
    });
  };

  if (draft) {
    return (
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-2.5 text-sm text-violet-500">
          <span className="inline-flex items-center gap-2">
            <Wand2 className="h-4 w-4" /> Auto-generated draft — review, tweak any cell, then Save.
          </span>
          <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
            <RotateCcw className="h-4 w-4" /> Start over
          </Button>
        </div>

        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
            <div className="mb-1 inline-flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4" /> {warnings.length} note(s)
            </div>
            <ul className="list-disc space-y-0.5 pl-5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <TimetableBuilder {...options} initial={draft} create />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatic Timetable</CardTitle>
        <Button variant="outline" size="sm" onClick={() => router.push("/timetable/new")}>
          Back
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted">
          Pick a class — the scheduler places each subject&apos;s weekly periods (from its
          L+T+P hours) into the week using the mapped faculty, avoiding faculty clashes.
          You then review and edit the draft before saving.
        </p>

        {msg && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">{msg}</div>
        )}

        {classes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line py-8 text-center text-sm text-faint">
            No subjects found. Add subjects (Masters → Subject) with L/T/P hours first.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Label>Class (Department · Semester · Scheme) <span className="text-red-500">*</span></Label>
              <SearchableSelect value={cls} onChange={setCls} options={classOpts} placeholder="Select a class" />
            </div>
            <div>
              <Label>Academic Year</Label>
              <Input value={acYear} onChange={(e) => setAcYear(e.target.value)} placeholder="e.g. 2026-27" />
            </div>
            <div className="lg:col-span-3">
              <Label>Title (optional)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults from the class name" />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={generate} disabled={generating || classes.length === 0}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {generating ? "Generating…" : "Generate Draft"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
