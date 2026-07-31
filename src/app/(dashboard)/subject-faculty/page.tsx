import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { subjectMasterT } from "@/db/schema";
import SubjectFacultyClient, { type SubjectOpt } from "./subject-faculty-client";

export default async function SubjectFacultyMappingPage() {
  const subjects = await db
    .select({
      id: subjectMasterT.id,
      subject_name: subjectMasterT.subject_name,
      subject_code: subjectMasterT.subject_code,
      semester: subjectMasterT.semester,
    })
    .from(subjectMasterT)
    .where(eq(subjectMasterT.display, "Y"))
    .orderBy(asc(subjectMasterT.subject_name));

  const opts: SubjectOpt[] = subjects.map((s) => ({
    value: String(s.id),
    label: [s.subject_code, s.subject_name, s.semester ? `(${s.semester})` : ""]
      .filter(Boolean)
      .join(" "),
  }));

  return <SubjectFacultyClient subjects={opts} />;
}
