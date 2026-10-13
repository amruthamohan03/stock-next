import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { studyMaterialT } from "@/db/schema";
import { getMaterialOptions } from "@/lib/study-material-queries";
import StudyMaterialForm, { type MaterialInitial } from "../../study-material-form";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditStudyMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const materialId = Number(id);
  if (!Number.isInteger(materialId) || materialId <= 0) notFound();

  const [options, rows] = await Promise.all([
    getMaterialOptions(),
    db
      .select()
      .from(studyMaterialT)
      .where(and(eq(studyMaterialT.id, materialId), eq(studyMaterialT.display, "Y")))
      .limit(1),
  ]);

  const m = rows[0];
  if (!m) notFound();

  const initial: MaterialInitial = {
    id: m.id,
    title: s(m.title),
    material_type: m.material_type ?? "NOTES",
    subject_id: s(m.subject_id),
    department_id: s(m.department_id),
    semester: s(m.semester),
    scheme: s(m.scheme),
    academic_year: s(m.academic_year),
    exam_session: s(m.exam_session),
    module_no: s(m.module_no),
    description: s(m.description),
    uploaded_by: s(m.uploaded_by),
  };

  return (
    <StudyMaterialForm
      subjects={options.subjects}
      departments={options.departments}
      staff={options.staff}
      initial={initial}
    />
  );
}
