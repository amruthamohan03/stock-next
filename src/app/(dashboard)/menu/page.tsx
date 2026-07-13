import { asc } from "drizzle-orm";
import { db } from "@/db";
import { menuMasterT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

// Ports MenuController (masters/menu) — CRUD for the sidebar menu tree.
// menu_level: 0 = First (top) level, 1 = Second level, 2 = legacy "Top Level".
const LEVEL_LABEL: Record<string, string> = {
  "0": "First Level",
  "1": "Second Level",
  "2": "Top Level",
};

const columns: ColumnDef[] = [
  { key: "menu_name", label: "Menu Name" },
  { key: "text", label: "Text" },
  { key: "url", label: "URL" },
  { key: "parent_name", label: "Parent" },
  { key: "level_label", label: "Level" },
  { key: "menu_order", label: "Order" },
  { key: "icon_display", label: "Icon" },
  { key: "display", label: "Status", badge: true },
];

export default async function MenuPage() {
  const rows = await db
    .select()
    .from(menuMasterT)
    .orderBy(
      asc(menuMasterT.menu_level),
      asc(menuMasterT.menu_order),
      asc(menuMasterT.id)
    );

  // Resolve parent names in memory (avoids a self-join).
  const nameById = new Map(rows.map((r) => [r.id, r.menu_name]));

  // Keep raw values for the edit form; add display-only derived columns.
  const tableRows = rows.map((r) => ({
    ...r,
    menu_id: r.menu_id ?? 0,
    parent_name: r.menu_id ? nameById.get(r.menu_id) ?? "—" : "—",
    level_label: LEVEL_LABEL[String(r.menu_level)] ?? "—",
    icon_display: (r.icon ?? "").trim() || "—",
  }));

  // Parent options = existing top-level menus (matches the PHP parent dropdown).
  const parentOptions = rows
    .filter((r) => r.menu_level === 0)
    .map((r) => ({ value: r.id, label: `${r.menu_name} (ID: ${r.id})` }));

  const fields: FieldDef[] = [
    {
      name: "menu_id",
      label: "Parent Menu",
      type: "select",
      default: 0,
      options: [
        { value: 0, label: "No parent (top level)" },
        ...parentOptions,
      ],
    },
    {
      name: "menu_level",
      label: "Menu Level",
      type: "select",
      required: true,
      options: [
        { value: 0, label: "First Level" },
        { value: 1, label: "Second Level" },
      ],
    },
    { name: "menu_order", label: "Menu Order", type: "number", required: true, default: 1 },
    { name: "menu_name", label: "Menu Name", required: true },
    { name: "url", label: "URL" },
    { name: "text", label: "Text" },
    { name: "icon", label: "Icon Class" },
    { name: "badge", label: "Badge" },
    {
      name: "display",
      label: "Display",
      type: "select",
      default: "Y",
      options: [
        { value: "Y", label: "Yes" },
        { value: "N", label: "No" },
      ],
    },
  ];

  return (
    <CrudTable
      apiKey="menu"
      title="Menu"
      columns={columns}
      rows={tableRows}
      fields={fields}
    />
  );
}
