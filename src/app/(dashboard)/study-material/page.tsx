import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import {
  attachmentT,
  departmentMasterT,
  staffT,
  studyMaterialT,
  subjectMasterT,
} from "@/db/schema";
import { buttonClasses } from "@/components/ui/button";
import StudyMaterialList from "./study-material-list";

// Study materials — lab manuals, notes, previous question papers.
export default async function StudyMaterialPage() {
  const rows = await db
    .select({
      id: studyMaterialT.id,
      title: studyMaterialT.title,
      material_type: studyMaterialT.material_type,
      semester: studyMaterialT.semester,
      scheme: studyMaterialT.scheme,
      academic_year: studyMaterialT.academic_year,
      exam_session: studyMaterialT.exam_session,
      module_no: studyMaterialT.module_no,
      created_at: studyMaterialT.created_at,
      subject_name: subjectMasterT.subject_name,
      subject_code: subjectMasterT.subject_code,
      department_name: departmentMasterT.department_name,
      uploader_name: staffT.staff_name,
      // One aggregate rather than a count query per row.
      file_count: sql<number>`count(${attachmentT.id})::int`,
    })
    .from(studyMaterialT)
    .leftJoin(subjectMasterT, eq(studyMaterialT.subject_id, subjectMasterT.id))
    .leftJoin(departmentMasterT, eq(studyMaterialT.department_id, departmentMasterT.id))
    .leftJoin(staffT, eq(studyMaterialT.uploaded_by, staffT.id))
    .leftJoin(
      attachmentT,
      and(
        eq(attachmentT.owner_type, "MATERIAL"),
        eq(attachmentT.owner_id, studyMaterialT.id),
        eq(attachmentT.display, "Y")
      )
    )
    .where(eq(studyMaterialT.display, "Y"))
    .groupBy(
      studyMaterialT.id,
      subjectMasterT.subject_name,
      subjectMasterT.subject_code,
      departmentMasterT.department_name,
      staffT.staff_name
    )
    .orderBy(desc(studyMaterialT.id));

  return (
    <StudyMaterialList
      rows={rows}
      actions={
        <Link href="/study-material/new" className={buttonClasses({ size: "sm" })}>
          <Plus className="h-4 w-4" /> New
        </Link>
      }
    />
  );
}
