import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { staffT } from "@/db/schema";

/** Separator in a staff option's label — split on it to recover the plain name. */
export const STAFF_LABEL_SEP = " — ";

export type StaffOption = {
  value: string;
  label: string;
  name: string;
  designation: string;
  department_id: string;
  /** staff_code — the employee number, e.g. a SPARK PEN. */
  code: string;
};

/**
 * Server-only: the active staff register as SearchableSelect options, with the
 * plain name and designation carried alongside so a form can prefill from a pick.
 */
export async function getStaffOptions(): Promise<StaffOption[]> {
  const staff = await db
    .select({
      id: staffT.id,
      name: staffT.staff_name,
      designation: staffT.designation,
      department_id: staffT.department_id,
      code: staffT.staff_code,
    })
    .from(staffT)
    .where(eq(staffT.display, "Y"))
    .orderBy(asc(staffT.staff_name));

  return staff.map((s) => ({
    value: String(s.id),
    label: s.designation ? `${s.name}${STAFF_LABEL_SEP}${s.designation}` : s.name,
    name: s.name,
    designation: s.designation ?? "",
    department_id: s.department_id ? String(s.department_id) : "",
    code: s.code ?? "",
  }));
}
