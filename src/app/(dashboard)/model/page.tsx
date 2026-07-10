import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { modelT, makeT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

const columns: ColumnDef[] = [
  { key: "model_name", label: "Model Name" },
  { key: "make_name", label: "Make" },
  { key: "display", label: "Status", badge: true },
];

export default async function ModelPage() {
  const [rows, makes] = await Promise.all([
    db
      .select({
        id: modelT.id,
        model_name: modelT.model_name,
        make_id: modelT.make_id,
        make_name: makeT.make_name,
        display: modelT.display,
      })
      .from(modelT)
      .leftJoin(makeT, eq(modelT.make_id, makeT.id))
      .where(eq(modelT.display, "Y"))
      .orderBy(desc(modelT.id)),
    db.select().from(makeT).where(eq(makeT.display, "Y")).orderBy(makeT.make_name),
  ]);

  const fields: FieldDef[] = [
    { name: "model_name", label: "Model Name", required: true },
    {
      name: "make_id",
      label: "Make",
      type: "select",
      required: true,
      options: makes.map((m) => ({ value: m.id, label: m.make_name })),
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

  return (
    <CrudTable apiKey="model" title="Model" columns={columns} rows={rows} fields={fields} />
  );
}
