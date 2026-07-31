import { asc, desc, eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { subjectMasterT, departmentMasterT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

const columns: ColumnDef[] = [
  { key: "subject_code", label: "Code" },
  { key: "subject_name", label: "Subject" },
  { key: "semester", label: "Sem" },
  { key: "scheme", label: "Scheme" },
  { key: "course_category", label: "Category" },
  { key: "subject_type", label: "Type", badge: true },
  { key: "credits", label: "Credits" },
  { key: "display", label: "Status", badge: true },
];

export default async function SubjectPage() {
  const departments = await db
    .select({ id: departmentMasterT.id, name: departmentMasterT.department_name })
    .from(departmentMasterT)
    .where(eq(departmentMasterT.display, "Y"))
    .orderBy(asc(departmentMasterT.department_name));

  const rows = await db
    .select({
      ...getTableColumns(subjectMasterT),
      department_name: departmentMasterT.department_name,
    })
    .from(subjectMasterT)
    .leftJoin(departmentMasterT, eq(departmentMasterT.id, subjectMasterT.department_id))
    .where(eq(subjectMasterT.display, "Y"))
    .orderBy(desc(subjectMasterT.id));

  const fields: FieldDef[] = [
    { name: "subject_code", label: "Subject Code", placeholder: "e.g. CS304" },
    { name: "subject_name", label: "Subject Name", required: true },
    {
      name: "department_id",
      label: "Department",
      type: "select",
      options: departments.map((d) => ({ value: d.id, label: d.name })),
    },
    { name: "semester", label: "Semester", placeholder: "e.g. S3" },
    { name: "scheme", label: "Scheme", placeholder: "e.g. Revision 2021" },
    { name: "course_category", label: "Course Category", placeholder: "e.g. Programme core course" },
    {
      name: "subject_type",
      label: "Type",
      type: "select",
      default: "THEORY",
      options: [
        { value: "THEORY", label: "Theory" },
        { value: "PRACTICAL", label: "Practical" },
      ],
    },
    { name: "lecture_hours", label: "Lecture Hrs (L)", type: "number", default: 0 },
    { name: "tutorial_hours", label: "Tutorial Hrs (T)", type: "number", default: 0 },
    { name: "practical_hours", label: "Practical Hrs (P)", type: "number", default: 0 },
    { name: "credits", label: "Credits", type: "number", placeholder: "e.g. 4 or 1.5" },
    {
      name: "display",
      label: "Status",
      type: "select",
      default: "Y",
      options: [
        { value: "Y", label: "Active" },
        { value: "N", label: "Inactive" },
      ],
    },
  ];

  return (
    <CrudTable apiKey="subject" title="Subject" columns={columns} rows={rows} fields={fields} />
  );
}
