import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { qualificationMasterT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

const columns: ColumnDef[] = [
  { key: "qualification_name", label: "Qualification" },
  { key: "display", label: "Status", badge: true },
];

const fields: FieldDef[] = [
  { name: "qualification_name", label: "Qualification Name", required: true, placeholder: "e.g. M.Tech" },
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

export default async function QualificationPage() {
  const rows = await db
    .select()
    .from(qualificationMasterT)
    .where(eq(qualificationMasterT.display, "Y"))
    .orderBy(asc(qualificationMasterT.qualification_name));

  return (
    <CrudTable apiKey="qualification" title="Qualification" columns={columns} rows={rows} fields={fields} />
  );
}
