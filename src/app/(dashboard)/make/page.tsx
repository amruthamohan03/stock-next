import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { makeT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

const columns: ColumnDef[] = [
  { key: "make_name", label: "Make Name" },
  { key: "display", label: "Status", badge: true },
];

const fields: FieldDef[] = [
  { name: "make_name", label: "Make Name", required: true },
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

export default async function MakePage() {
  const rows = await db
    .select()
    .from(makeT)
    .where(eq(makeT.display, "Y"))
    .orderBy(desc(makeT.id));

  return (
    <CrudTable apiKey="make" title="Make" columns={columns} rows={rows} fields={fields} />
  );
}
