import { asc, desc, eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { staffT, departmentMasterT, designationMasterT, qualificationMasterT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

const columns: ColumnDef[] = [
  { key: "staff_code", label: "Code" },
  { key: "staff_name", label: "Name" },
  { key: "designation", label: "Designation" },
  { key: "department_name", label: "Department" },
  { key: "posting_type", label: "Posting", badge: true },
  { key: "phone", label: "Phone" },
  { key: "max_periods_per_week", label: "Periods/Wk" },
  { key: "display", label: "Status", badge: true },
];

export default async function StaffPage() {
  const [departments, designations, qualifications] = await Promise.all([
    db
      .select({ id: departmentMasterT.id, name: departmentMasterT.department_name })
      .from(departmentMasterT)
      .where(eq(departmentMasterT.display, "Y"))
      .orderBy(asc(departmentMasterT.department_name)),
    db
      .select({ name: designationMasterT.designation_name })
      .from(designationMasterT)
      .where(eq(designationMasterT.display, "Y"))
      .orderBy(asc(designationMasterT.designation_name)),
    db
      .select({ name: qualificationMasterT.qualification_name })
      .from(qualificationMasterT)
      .where(eq(qualificationMasterT.display, "Y"))
      .orderBy(asc(qualificationMasterT.qualification_name)),
  ]);

  const rows = await db
    .select({
      ...getTableColumns(staffT),
      department_name: departmentMasterT.department_name,
    })
    .from(staffT)
    .leftJoin(departmentMasterT, eq(departmentMasterT.id, staffT.department_id))
    .where(eq(staffT.display, "Y"))
    .orderBy(desc(staffT.id));

  const fields: FieldDef[] = [
    { name: "staff_code", label: "Staff Code", placeholder: "Leave blank to auto-generate (e.g. STF0002)" },
    { name: "staff_name", label: "Staff Name", required: true },
    {
      name: "designation",
      label: "Designation",
      type: "select",
      options: designations.map((d) => ({ value: d.name, label: d.name })),
    },
    {
      name: "department_id",
      label: "Department",
      type: "select",
      options: departments.map((d) => ({ value: d.id, label: d.name })),
    },
    {
      name: "posting_type",
      label: "Posting Type",
      type: "select",
      default: "PERMANENT",
      options: [
        { value: "PERMANENT", label: "Permanent" },
        { value: "GUEST", label: "Guest" },
      ],
    },
    {
      name: "qualification",
      label: "Highest Qualification",
      type: "select",
      options: qualifications.map((q) => ({ value: q.name, label: q.name })),
    },
    {
      name: "subjects",
      label: "Subjects / Specialization",
      type: "textarea",
      placeholder: "Subjects this staff can handle (used for timetable & duty allocation)",
    },
    { name: "max_periods_per_week", label: "Max Periods / Week", type: "number", default: 0 },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone" },
    {
      name: "gender",
      label: "Gender",
      type: "select",
      options: [
        { value: "Male", label: "Male" },
        { value: "Female", label: "Female" },
        { value: "Other", label: "Other" },
      ],
    },
    { name: "date_of_joining", label: "Date of Joining", type: "date" },
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
    <CrudTable apiKey="staff" title="Staff" columns={columns} rows={rows} fields={fields} />
  );
}
