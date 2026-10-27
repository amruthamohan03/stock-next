import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { stockBookMasterT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";
import { getBookOptions, labelFor, labelsFor } from "@/lib/book-queries";

/**
 * Stock Book master — the bound stock registers themselves.
 *
 * Not to be confused with /stockbooks, which is the per-item/location balance
 * ledger (stock_book_t). This is the book an entry is written into, the one
 * indent_item_t.stock_book_volume and stock_book_page_no refer to.
 */
const columns: ColumnDef[] = [
  { key: "book_name", label: "Book Name" },
  { key: "book_no", label: "Book No" },
  { key: "volume", label: "Volume" },
  { key: "register_type_name", label: "Register Type" },
  { key: "department_name", label: "Department" },
  { key: "item_types_label", label: "Item Types" },
  { key: "display", label: "Status", badge: true },
];

export default async function StockBookPage() {
  const [rows, options] = await Promise.all([
    db
      .select()
      .from(stockBookMasterT)
      .where(eq(stockBookMasterT.display, "Y"))
      .orderBy(desc(stockBookMasterT.id)),
    getBookOptions(),
  ]);

  const fields: FieldDef[] = [
    { name: "book_name", label: "Book Name", required: true, placeholder: "Non-Consumable Stock Register" },
    { name: "book_no", label: "Book No", type: "number", placeholder: "Number printed on the cover" },
    { name: "volume", label: "Volume", type: "number", default: 1 },
    { name: "stockbook_type_id", label: "Register Type", type: "select", options: options.registerTypes },
    { name: "department_id", label: "Department", type: "select", options: options.departments },
    { name: "academic_year", label: "Academic Year", placeholder: "2025-26" },
    { name: "total_pages", label: "Total Pages", type: "number" },
    { name: "item_type_ids", label: "Item Types Handled", type: "multiselect", options: options.itemTypes },
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

  const display = rows.map((r) => ({
    ...r,
    register_type_name: labelFor(r.stockbook_type_id, options.registerTypes),
    department_name: labelFor(r.department_id, options.departments),
    item_types_label: labelsFor(r.item_type_ids, options.itemTypes),
  }));

  return (
    <CrudTable
      apiKey="stock-book"
      title="Stock Book"
      columns={columns}
      rows={display}
      fields={fields}
    />
  );
}
