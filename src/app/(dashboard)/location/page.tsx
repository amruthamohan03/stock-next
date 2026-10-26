import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { issuedToMasterT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

/**
 * Location master — where items are kept and where they are issued to.
 *
 * Backed by issued_to_master_t, the table the stock ledger already references
 * through issued_to_location_id / transferred_from_location_id. It had no UI
 * until now, so locations could only be added in the database.
 */
const columns: ColumnDef[] = [
  { key: "location_code", label: "Code" },
  { key: "location_name", label: "Location" },
  { key: "contact_person", label: "Contact Person" },
  { key: "phone", label: "Phone" },
  { key: "display", label: "Status", badge: true },
];

const fields: FieldDef[] = [
  {
    name: "location_code",
    label: "Code",
    required: true,
    placeholder: "CCF LAB",
  },
  {
    name: "location_name",
    label: "Location Name",
    required: true,
    placeholder: "CCF Lab",
  },
  { name: "contact_person", label: "Contact Person" },
  { name: "phone", label: "Phone" },
  { name: "description", label: "Description", type: "textarea" },
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

export default async function LocationPage() {
  const rows = await db
    .select()
    .from(issuedToMasterT)
    .where(eq(issuedToMasterT.display, "Y"))
    .orderBy(asc(issuedToMasterT.location_name));

  return (
    <CrudTable apiKey="location" title="Location" columns={columns} rows={rows} fields={fields} />
  );
}
