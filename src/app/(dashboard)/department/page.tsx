import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { departmentMasterT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

const columns: ColumnDef[] = [
  { key: "department_name", label: "Department Name" },
  { key: "display", label: "Status", badge: true },
];

const fields: FieldDef[] = [
  { name: "department_name", label: "Department Name", required: true },
  { name: "college_id", label: "College ID", type: "number", default: 1 },
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

export default async function DepartmentPage() {
  const rows = await db
    .select()
    .from(departmentMasterT)
    .where(eq(departmentMasterT.display, "Y"))
    .orderBy(desc(departmentMasterT.id));

  return (
    <CrudTable
      apiKey="department"
      title="Department"
      columns={columns}
      rows={rows}
      fields={fields}
    />
  );
}
