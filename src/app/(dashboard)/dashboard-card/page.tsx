import { asc, eq, ne, and } from "drizzle-orm";
import { db } from "@/db";
import { dashboardCardMasterT, menuMasterT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

// Ports DashboardCardController (masters/dashboard_card) — CRUD for dashboard_card_master_t.
const CATEGORIES = ["general", "import", "export", "finance", "admin"];
const COLORS = ["primary", "success", "warning", "danger", "info", "purple", "teal", "pink"];

const columns: ColumnDef[] = [
  { key: "card_key", label: "Key" },
  { key: "card_title", label: "Title" },
  { key: "menu_name", label: "Page" },
  { key: "card_icon", label: "Icon" },
  { key: "card_color", label: "Color", badge: true },
  { key: "card_category", label: "Category", badge: true },
  { key: "card_url", label: "URL" },
  { key: "card_order", label: "Order" },
  { key: "display", label: "Status", badge: true },
];

export default async function DashboardCardPage() {
  const [cards, menus] = await Promise.all([
    db.select().from(dashboardCardMasterT).orderBy(asc(dashboardCardMasterT.card_order)),
    // Selectable pages: active menus that point at a real url (mirrors the PHP filter).
    db
      .select({ id: menuMasterT.id, menu_name: menuMasterT.menu_name })
      .from(menuMasterT)
      .where(and(eq(menuMasterT.display, "Y"), ne(menuMasterT.url, "#")))
      .orderBy(asc(menuMasterT.menu_name)),
  ]);

  const menuById = new Map(menus.map((m) => [m.id, m.menu_name]));

  const rows = cards.map((c) => ({
    ...c,
    menu_name: (c.menu_id && menuById.get(c.menu_id)) || "—",
  }));

  const fields: FieldDef[] = [
    { name: "card_key", label: "Card Key", required: true, placeholder: "e.g. total_users" },
    { name: "card_title", label: "Card Title", required: true },
    { name: "card_subtitle", label: "Card Subtitle" },
    {
      name: "menu_id",
      label: "Page",
      type: "select",
      required: true,
      options: menus.map((m) => ({ value: m.id, label: m.menu_name ?? `#${m.id}` })),
    },
    { name: "card_icon", label: "Card Icon", default: "bi-card-text", placeholder: "e.g. bi-people-fill" },
    {
      name: "card_color",
      label: "Card Color",
      type: "select",
      default: "primary",
      options: COLORS.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) })),
    },
    {
      name: "card_category",
      label: "Category",
      type: "select",
      default: "general",
      options: CATEGORIES.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) })),
    },
    { name: "card_url", label: "Card URL", placeholder: "e.g. /users" },
    { name: "card_order", label: "Display Order", type: "number", default: 0 },
    { name: "data_source", label: "Data Source (optional)", type: "textarea" },
    {
      name: "display",
      label: "Display",
      type: "select",
      default: "Y",
      options: [
        { value: "Y", label: "Yes (Active)" },
        { value: "N", label: "No (Inactive)" },
      ],
    },
  ];

  return (
    <CrudTable
      apiKey="dashboard-card"
      title="Dashboard Card"
      columns={columns}
      rows={rows}
      fields={fields}
    />
  );
}
