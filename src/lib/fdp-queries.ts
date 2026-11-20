import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { departmentMasterT, subjectMasterT } from "@/db/schema";
import { getStaffOptions } from "@/lib/staff-queries";

/**
 * Server-only option loaders for the FDP form. Kept apart from `fdp.ts`, which
 * client components import for its labels and helpers — pulling the `db`
 * client in alongside them would drag postgres.js into the browser bundle.
 */
export async function getFdpOptions() {
  const [staff, subjects, departments] = await Promise.all([
    getStaffOptions(),
    db
      .select({
        id: subjectMasterT.id,
        subject_code: subjectMasterT.subject_code,
        subject_name: subjectMasterT.subject_name,
        department_id: subjectMasterT.department_id,
      })
      .from(subjectMasterT)
      .where(eq(subjectMasterT.display, "Y"))
      .orderBy(asc(subjectMasterT.subject_name)),
    db
      .select({ id: departmentMasterT.id, name: departmentMasterT.department_name })
      .from(departmentMasterT)
      .where(eq(departmentMasterT.display, "Y"))
      .orderBy(asc(departmentMasterT.department_name)),
  ]);

  return {
    // The label's "Name — Designation" shape is split on save to recover the
    // plain name (STAFF_LABEL_SEP), so keep fdp-form.tsx in step with it.
    staff,
    subjects: subjects.map((s) => ({
      value: String(s.id),
      label: s.subject_code ? `${s.subject_code} — ${s.subject_name}` : s.subject_name,
      department_id: s.department_id ? String(s.department_id) : "",
    })),
    departments: departments.map((d) => ({ value: String(d.id), label: d.name })),
  };
}
