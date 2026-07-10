import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceProvidersT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

const columns: ColumnDef[] = [
  { key: "provider_name", label: "Provider" },
  { key: "type", label: "Type", badge: true },
  { key: "phone_no", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "display", label: "Status", badge: true },
];

const fields: FieldDef[] = [
  { name: "provider_name", label: "Provider Name", required: true },
  {
    name: "type",
    label: "Type",
    type: "select",
    required: true,
    default: "private",
    options: [
      { value: "public", label: "Public" },
      { value: "private", label: "Private" },
    ],
  },
  { name: "phone_no", label: "Phone Number", required: true },
  { name: "email", label: "Email", required: true },
  { name: "gst_no", label: "GST No." },
  { name: "address", label: "Address", type: "textarea", required: true },
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

export default async function ProviderPage() {
  const rows = await db
    .select()
    .from(serviceProvidersT)
    .where(eq(serviceProvidersT.display, "Y"))
    .orderBy(desc(serviceProvidersT.id));

  return (
    <CrudTable
      apiKey="provider"
      title="Service Provider"
      columns={columns}
      rows={rows}
      fields={fields}
    />
  );
}
