import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { departmentMasterT, staffT, subjectMasterT } from "@/db/schema";

/**
 * Server-only option loaders for the study-material form.
 *
 * Kept apart from `study-material.ts`, which client components import for its
 * labels and tints — pulling the `db` client in alongside them would drag
 * postgres.js into the browser bundle.
 */
export async function getMaterialOptions() {
  const [subjects, departments, staff] = await Promise.all([
    db
      .select({
        id: subjectMasterT.id,
        subject_code: subjectMasterT.subject_code,
        subject_name: subjectMasterT.subject_name,
        department_id: subjectMasterT.department_id,
        semester: subjectMasterT.semester,
        scheme: subjectMasterT.scheme,
      })
      .from(subjectMasterT)
      .where(eq(subjectMasterT.display, "Y"))
      .orderBy(asc(subjectMasterT.subject_name)),
    db
      .select({ id: departmentMasterT.id, name: departmentMasterT.department_name })
      .from(departmentMasterT)
      .where(eq(departmentMasterT.display, "Y"))
      .orderBy(asc(departmentMasterT.department_name)),
    db
      .select({ id: staffT.id, name: staffT.staff_name, designation: staffT.designation })
      .from(staffT)
      .where(eq(staffT.display, "Y"))
      .orderBy(asc(staffT.staff_name)),
  ]);

  return {
    subjects: subjects.map((s) => ({
      value: String(s.id),
      label: s.subject_code ? `${s.subject_code} — ${s.subject_name}` : s.subject_name,
      department_id: s.department_id ? String(s.department_id) : "",
      semester: s.semester ?? "",
      scheme: s.scheme ?? "",
    })),
    departments: departments.map((d) => ({ value: String(d.id), label: d.name })),
    staff: staff.map((s) => ({
      value: String(s.id),
      label: s.designation ? `${s.name} — ${s.designation}` : s.name,
    })),
  };
}
