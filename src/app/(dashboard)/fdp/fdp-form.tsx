"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api-client";
import { FDP_MODE_OPTIONS, durationLabel } from "@/lib/fdp";

export type Option = { value: string; label: string };
export type StaffOption = Option & { department_id: string };
export type SubjectOption = Option & { department_id: string };

export type FdpInitial = {
  id: number;
  title: string;
  staff_id: string;
  faculty_name: string;
  organizer: string;
  collaborator: string;
  mode: string;
  venue: string;
  start_date: string;
  end_date: string;
  academic_year: string;
  subject_id: string;
  department_id: string;
  topics: string;
  remarks: string;
};

export default function FdpForm({
  staff,
  subjects,
  departments,
  initial,
}: {
  staff: StaffOption[];
  subjects: SubjectOption[];
  departments: Option[];
  initial?: FdpInitial;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!initial;

  const [form, setForm] = useState<Omit<FdpInitial, "id">>({
    title: initial?.title ?? "",
    staff_id: initial?.staff_id ?? "",
    faculty_name: initial?.faculty_name ?? "",
    organizer: initial?.organizer ?? "",
    collaborator: initial?.collaborator ?? "",
    mode: initial?.mode ?? "ONLINE",
    venue: initial?.venue ?? "",
    start_date: initial?.start_date ?? "",
    end_date: initial?.end_date ?? "",
    academic_year: initial?.academic_year ?? "",
    subject_id: initial?.subject_id ?? "",
    department_id: initial?.department_id ?? "",
    topics: initial?.topics ?? "",
    remarks: initial?.remarks ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // Shown live so the dates can be sanity-checked against the brochure.
  const days = durationLabel(form.start_date || null, form.end_date || null);
  const datesBackwards =
    !!form.start_date && !!form.end_date && form.end_date < form.start_date;

  const save = async () => {
    setError(null);
    if (!form.title.trim()) {
      setError("Programme title is required.");
      return;
    }
    if (!form.staff_id && !form.faculty_name.trim()) {
      setError("Pick the faculty member, or type a name.");
      return;
    }
    if (datesBackwards) {
      setError("The end date is before the start date.");
      return;
    }
    setSaving(true);
    const result = await apiRequest<{ data?: { id: number } }>("/api/masters/fdp", {
      method: editing ? "PUT" : "POST",
      body: {
        id: initial?.id,
        ...form,
        // Blank selects/dates must clear the column, not write "" into an
        // integer or date field.
        staff_id: form.staff_id || null,
        subject_id: form.subject_id || null,
        department_id: form.department_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        display: "Y",
      },
    });
    setSaving(false);
    if (result.success) {
      toast.success(result.message || (editing ? "FDP updated" : "FDP saved"));
      const id = initial?.id ?? result.data?.data?.id;
      router.push(id ? `/fdp/${id}` : "/fdp");
      router.refresh();
    } else {
      setError(result.message);
      toast.error(result.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? "Edit FDP Record" : "New FDP Record"}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(editing ? `/fdp/${initial!.id}` : "/fdp")}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : editing ? "Update" : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>
              Programme title <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Foundational IT Skills & Generative AI"
            />
          </div>

          <div>
            <Label>
              Faculty <span className="text-red-500">*</span>
            </Label>
            <SearchableSelect
              value={form.staff_id}
              onChange={(v) => {
                const s = staff.find((x) => x.value === v);
                set({
                  staff_id: v,
                  // Keep the name in step with the pick, and borrow their
                  // department when one has not been chosen yet.
                  faculty_name: s ? s.label.split(" — ")[0] : form.faculty_name,
                  department_id: form.department_id || s?.department_id || "",
                });
              }}
              options={staff}
              placeholder="Select from the staff register…"
            />
          </div>
          <div>
            <Label>Or type a name</Label>
            <Input
              value={form.faculty_name}
              onChange={(e) => set({ faculty_name: e.target.value })}
              placeholder="For someone not on the register"
            />
          </div>

          <div>
            <Label>Organised by</Label>
            <Input
              value={form.organizer}
              onChange={(e) => set({ organizer: e.target.value })}
              placeholder="SITTTR, Kalamassery"
            />
          </div>
          <div>
            <Label>In association with</Label>
            <Input
              value={form.collaborator}
              onChange={(e) => set({ collaborator: e.target.value })}
              placeholder="Govt Polytechnic College, Kaduthuruthy"
            />
          </div>

          <div>
            <Label>Mode</Label>
            <SearchableSelect
              value={form.mode}
              onChange={(v) => set({ mode: v })}
              options={FDP_MODE_OPTIONS}
            />
          </div>
          <div>
            <Label>Venue / platform</Label>
            <Input
              value={form.venue}
              onChange={(e) => set({ venue: e.target.value })}
              placeholder="Google Meet"
            />
          </div>

          <div>
            <Label>From</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => set({ start_date: e.target.value })}
            />
          </div>
          <div>
            <Label>
              To{" "}
              {days && !datesBackwards && (
                <span className="font-normal text-accent">· {days}</span>
              )}
            </Label>
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => set({ end_date: e.target.value })}
            />
            {datesBackwards && (
              <p className="mt-1 text-xs text-red-500">The end date is before the start date.</p>
            )}
          </div>

          <div>
            <Label>Academic year</Label>
            <Input
              value={form.academic_year}
              onChange={(e) => set({ academic_year: e.target.value })}
              placeholder="2026-27"
            />
          </div>
          <div>
            <Label>Subject</Label>
            <SearchableSelect
              value={form.subject_id}
              onChange={(v) => {
                const s = subjects.find((x) => x.value === v);
                set({
                  subject_id: v,
                  department_id: form.department_id || s?.department_id || "",
                });
              }}
              options={subjects}
              placeholder="Related subject, if any…"
            />
          </div>
          <div>
            <Label>Department</Label>
            <SearchableSelect
              value={form.department_id}
              onChange={(v) => set({ department_id: v })}
              options={departments}
              placeholder="Select department…"
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Topics covered</Label>
            <AutoGrowTextarea
              value={form.topics}
              onChange={(e) => set({ topics: e.target.value })}
              placeholder="One per line, or separated by commas"
              className="w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
            />
            <p className="mt-1 text-xs text-faint">
              Each line (or comma-separated entry) becomes its own chip.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Label>Remarks</Label>
            <Input
              value={form.remarks}
              onChange={(e) => set({ remarks: e.target.value })}
            />
          </div>
        </div>

        {!editing && (
          <p className="text-sm text-muted">
            Save first — the certificate and schedule are attached on the record&apos;s own page.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
