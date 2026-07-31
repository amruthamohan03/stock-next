import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { departmentMasterT, subjectMasterT, staffT, designationMasterT } from "@/db/schema";

export type Opt = { id: number; name: string };

/** Dropdowns for the timetable builder: departments, subjects, teaching faculty. */
export async function getTimetableOptions(): Promise<{
  departments: Opt[];
  subjects: { id: number; name: string; code: string | null }[];
  faculty: Opt[];
}> {
  const [departments, subjects, faculty] = await Promise.all([
    db
      .select({ id: departmentMasterT.id, name: departmentMasterT.department_name })
      .from(departmentMasterT)
      .where(eq(departmentMasterT.display, "Y"))
      .orderBy(asc(departmentMasterT.department_name)),
    db
      .select({
        id: subjectMasterT.id,
        name: subjectMasterT.subject_name,
        code: subjectMasterT.subject_code,
        semester: subjectMasterT.semester,
      })
      .from(subjectMasterT)
      .where(eq(subjectMasterT.display, "Y"))
      .orderBy(asc(subjectMasterT.subject_code)),
    // Faculty = active staff with a teaching designation.
    db
      .select({ id: staffT.id, name: staffT.staff_name })
      .from(staffT)
      .innerJoin(
        designationMasterT,
        and(
          eq(designationMasterT.designation_name, staffT.designation),
          eq(designationMasterT.staff_type, "TEACHING"),
          eq(designationMasterT.display, "Y")
        )
      )
      .where(eq(staffT.display, "Y"))
      .orderBy(asc(staffT.staff_name)),
  ]);

  return {
    departments: departments.map((d) => ({ id: Number(d.id), name: d.name ?? "" })),
    subjects: subjects.map((s) => ({
      id: Number(s.id),
      name: [s.code, s.name, s.semester ? `(${s.semester})` : ""].filter(Boolean).join(" "),
      code: s.code,
    })),
    faculty: faculty.map((f) => ({ id: Number(f.id), name: f.name ?? "" })),
  };
}
