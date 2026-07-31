import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { designationMasterT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

const columns: ColumnDef[] = [
  { key: "designation_name", label: "Designation" },
  { key: "staff_type", label: "Staff Type", badge: true },
  { key: "staff_category", label: "Category", badge: true },
  { key: "display", label: "Status", badge: true },
];

const fields: FieldDef[] = [
  { name: "designation_name", label: "Designation Name", required: true, placeholder: "e.g. Lecturer" },
  {
    name: "staff_type",
    label: "Staff Type",
    type: "select",
    default: "TEACHING",
    options: [
      { value: "TEACHING", label: "Teaching" },
      { value: "NON_TEACHING", label: "Non-Teaching" },
    ],
  },
  {
    name: "staff_category",
    label: "Category",
    type: "select",
    default: "FACULTY",
    options: [
      { value: "FACULTY", label: "Faculty" },
      { value: "LAB_STAFF", label: "Lab Staff" },
      { value: "OFFICE_STAFF", label: "Office Staff" },
      { value: "OTHER", label: "Other Staff" },
    ],
  },
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

export default async function DesignationPage() {
  const rows = await db
    .select()
    .from(designationMasterT)
    .where(eq(designationMasterT.display, "Y"))
    .orderBy(asc(designationMasterT.designation_name));

  return (
    <CrudTable apiKey="designation" title="Designation" columns={columns} rows={rows} fields={fields} />
  );
}
