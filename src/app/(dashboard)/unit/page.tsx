import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { daybookUnitT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

const columns: ColumnDef[] = [
  { key: "name", label: "Unit Name" },
  { key: "display", label: "Status", badge: true },
];

const fields: FieldDef[] = [
  { name: "name", label: "Unit Name", required: true },
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

export default async function UnitPage() {
  const rows = await db
    .select()
    .from(daybookUnitT)
    .where(eq(daybookUnitT.display, "Y"))
    .orderBy(desc(daybookUnitT.id));

  return (
    <CrudTable apiKey="unit" title="Unit" columns={columns} rows={rows} fields={fields} />
  );
}
