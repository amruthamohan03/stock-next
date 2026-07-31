import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { subjectMasterT, departmentMasterT } from "@/db/schema";
import { getTimetableOptions } from "../../options";
import AutoTimetable, { type ClassOpt } from "./auto-timetable";

export default async function AutoTimetablePage() {
  const [options, classesRaw] = await Promise.all([
    getTimetableOptions(),
    db
      .select({
        department_id: subjectMasterT.department_id,
        department_name: departmentMasterT.department_name,
        semester: subjectMasterT.semester,
        scheme: subjectMasterT.scheme,
        n: sql<number>`count(*)::int`,
      })
      .from(subjectMasterT)
      .leftJoin(departmentMasterT, eq(departmentMasterT.id, subjectMasterT.department_id))
      .where(and(eq(subjectMasterT.display, "Y")))
      .groupBy(
        subjectMasterT.department_id,
        departmentMasterT.department_name,
        subjectMasterT.semester,
        subjectMasterT.scheme
      )
      .orderBy(asc(departmentMasterT.department_name), asc(subjectMasterT.semester)),
  ]);

  const classes: ClassOpt[] = classesRaw
    .filter((c) => c.department_id && c.semester)
    .map((c) => ({
      value: `${c.department_id}|${c.semester ?? ""}|${c.scheme ?? ""}`,
      label: `${c.department_name ?? "Dept " + c.department_id} · ${c.semester}${
        c.scheme ? ` · ${c.scheme}` : ""
      } (${c.n} subjects)`,
      department_id: Number(c.department_id),
      department_name: c.department_name ?? "",
      semester: c.semester ?? "",
      scheme: c.scheme ?? "",
    }));

  return <AutoTimetable options={options} classes={classes} />;
}
