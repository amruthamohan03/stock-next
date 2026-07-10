import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { itemMasterT, quotationCategoriesT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";

const columns: ColumnDef[] = [
  { key: "item_name", label: "Item Name" },
  { key: "category_name", label: "Category" },
  { key: "tax_not_tax", label: "Tax", badge: true },
  { key: "display", label: "Status", badge: true },
];

export default async function ItemPage() {
  const [rows, categories] = await Promise.all([
    db
      .select({
        id: itemMasterT.id,
        item_name: itemMasterT.item_name,
        item_code: itemMasterT.item_code,
        category_id: itemMasterT.category_id,
        category_name: quotationCategoriesT.category_name,
        tax_not_tax: itemMasterT.tax_not_tax,
        display: itemMasterT.display,
      })
      .from(itemMasterT)
      .leftJoin(
        quotationCategoriesT,
        eq(itemMasterT.category_id, quotationCategoriesT.id)
      )
      .where(eq(itemMasterT.display, "Y"))
      .orderBy(desc(itemMasterT.id)),
    db
      .select()
      .from(quotationCategoriesT)
      .where(eq(quotationCategoriesT.display, "Y"))
      .orderBy(quotationCategoriesT.category_name),
  ]);

  const fields: FieldDef[] = [
    { name: "item_name", label: "Item Name", required: true },
    { name: "item_code", label: "Item Code" },
    {
      name: "category_id",
      label: "Category",
      type: "select",
      required: true,
      options: categories.map((c) => ({ value: c.id, label: c.category_name })),
    },
    {
      name: "tax_not_tax",
      label: "Taxable",
      type: "select",
      default: "N",
      options: [
        { value: "N", label: "Non-taxable (N)" },
        { value: "C", label: "Taxable (C)" },
      ],
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
    <CrudTable apiKey="item" title="Item" columns={columns} rows={rows} fields={fields} />
  );
}
