import { sql } from "drizzle-orm";
import { db } from "@/db";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

/**
 * Group Item Name master — the families items are grouped under (COMPUTER,
 * TABLE, CHAIR …). The item master points at one, and the stock reports group
 * their totals by it, so the "Items" column shows how many items each group
 * holds before anyone retires one.
 */
const columns: ColumnDef[] = [
  { key: "group_name", label: "Group Name" },
  { key: "group_code", label: "Code" },
  { key: "item_count", label: "Items" },
  { key: "display", label: "Status", badge: true },
];

const fields: FieldDef[] = [
  { name: "group_name", label: "Group Name", required: true, placeholder: "COMPUTER" },
  { name: "group_code", label: "Code", placeholder: "COM" },
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

export default async function GroupPage() {
  const result = await db.execute(sql`
    SELECT g.id, g.group_name, g.group_code, g.display,
           COUNT(i.id)::int AS item_count
    FROM group_item_name_master_t g
    LEFT JOIN item_master_t i ON i.group_id = g.id AND i.display = 'Y'
    WHERE g.display = 'Y'
    GROUP BY g.id, g.group_name, g.group_code, g.display
    ORDER BY g.group_name ASC
  `);

  const rows = (result as unknown as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    group_name: String(r.group_name ?? ""),
    group_code: (r.group_code as string) ?? "",
    item_count: Number(r.item_count ?? 0),
    display: String(r.display ?? "Y"),
  }));

  return (
    <CrudTable
      apiKey="group"
      title="Item Group"
      columns={columns}
      rows={rows}
      fields={fields}
    />
  );
}
