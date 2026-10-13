"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api-client";
import {
  MATERIAL_TYPE_OPTIONS,
  SEMESTER_OPTIONS,
  detailFieldFor,
} from "@/lib/study-material";

export type Option = { value: string; label: string };

/** Subjects carry their own department/semester/scheme, used to prefill. */
export type SubjectOption = Option & {
  department_id: string;
  semester: string;
  scheme: string;
};

export type MaterialInitial = {
  id: number;
  title: string;
  material_type: string;
  subject_id: string;
  department_id: string;
  semester: string;
  scheme: string;
  academic_year: string;
  exam_session: string;
  module_no: string;
  description: string;
  uploaded_by: string;
};

export default function StudyMaterialForm({
  subjects,
  departments,
  staff,
  initial,
}: {
  subjects: SubjectOption[];
  departments: Option[];
  staff: Option[];
  initial?: MaterialInitial;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!initial;

  const [form, setForm] = useState<Omit<MaterialInitial, "id">>({
    title: initial?.title ?? "",
    material_type: initial?.material_type ?? "NOTES",
    subject_id: initial?.subject_id ?? "",
    department_id: initial?.department_id ?? "",
    semester: initial?.semester ?? "",
    scheme: initial?.scheme ?? "",
    academic_year: initial?.academic_year ?? "",
    exam_session: initial?.exam_session ?? "",
    module_no: initial?.module_no ?? "",
    description: initial?.description ?? "",
    uploaded_by: initial?.uploaded_by ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  /** Only the field that matters for this type is asked for. */
  const detailKey = detailFieldFor(form.material_type);

  const save = async () => {
    setError(null);
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    const result = await apiRequest<{ data?: { id: number } }>("/api/masters/study-material", {
      method: editing ? "PUT" : "POST",
      body: {
        id: initial?.id,
        ...form,
        // Blank selects must clear the column, not write an empty string into
        // an integer field.
        subject_id: form.subject_id || null,
        department_id: form.department_id || null,
        uploaded_by: form.uploaded_by || null,
        display: "Y",
      },
    });
    setSaving(false);
    if (result.success) {
      toast.success(result.message || (editing ? "Material updated" : "Material saved"));
      const id = initial?.id ?? result.data?.data?.id;
      router.push(id ? `/study-material/${id}` : "/study-material");
      router.refresh();
    } else {
      setError(result.message);
      toast.error(result.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? "Edit Study Material" : "New Study Material"}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(editing ? `/study-material/${initial!.id}` : "/study-material")
            }
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
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Data Structures — Lab Manual"
            />
          </div>

          <div>
            <Label>Type</Label>
            <SearchableSelect
              value={form.material_type}
              onChange={(v) => set({ material_type: v })}
              options={MATERIAL_TYPE_OPTIONS}
            />
          </div>

          <div>
            <Label>Subject</Label>
            <SearchableSelect
              value={form.subject_id}
              onChange={(v) => {
                // Pull the subject's department, semester and scheme across —
                // they are almost always the same, and still editable below.
                const s = subjects.find((x) => x.value === v);
                set({
                  subject_id: v,
                  department_id: form.department_id || s?.department_id || "",
                  semester: form.semester || s?.semester || "",
                  scheme: form.scheme || s?.scheme || "",
                });
              }}
              options={subjects}
              placeholder="Select subject…"
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

          <div>
            <Label>Semester</Label>
            <SearchableSelect
              value={form.semester}
              onChange={(v) => set({ semester: v })}
              options={SEMESTER_OPTIONS}
              placeholder="Select semester…"
            />
          </div>

          <div>
            <Label>Academic year</Label>
            <Input
              value={form.academic_year}
              onChange={(e) => set({ academic_year: e.target.value })}
              placeholder="2025-26"
            />
          </div>

          <div>
            <Label>Scheme</Label>
            <Input
              value={form.scheme}
              onChange={(e) => set({ scheme: e.target.value })}
              placeholder="Revision 2021"
            />
          </div>

          {detailKey === "exam_session" && (
            <div>
              <Label>Exam session</Label>
              <Input
                value={form.exam_session}
                onChange={(e) => set({ exam_session: e.target.value })}
                placeholder="April 2025"
              />
            </div>
          )}
          {detailKey === "module_no" && (
            <div>
              <Label>Module</Label>
              <Input
                value={form.module_no}
                onChange={(e) => set({ module_no: e.target.value })}
                placeholder="Module 3"
              />
            </div>
          )}

          <div>
            <Label>Prepared by</Label>
            <SearchableSelect
              value={form.uploaded_by}
              onChange={(v) => set({ uploaded_by: v })}
              options={staff}
              placeholder="Select staff…"
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="What this material covers"
            />
          </div>
        </div>

        {!editing && (
          <p className="text-sm text-muted">
            Save first — files are attached on the material&apos;s own page.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
