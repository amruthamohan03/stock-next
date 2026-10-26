import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { indentBookT } from "@/db/schema";
import CrudTable, { type FieldDef, type ColumnDef } from "@/components/crud-table";
import { getBookOptions, labelFor, labelsFor } from "@/lib/book-queries";

/**
 * Indent Book master — the physical indent registers kept in the store.
 *
 * An indent's `book_no` is the id of one of these rows, so the indent form can
 * offer them as a dropdown instead of asking for a bare number.
 */
const columns: ColumnDef[] = [
  { key: "book_name", label: "Book Name" },
  { key: "book_no", label: "Book No" },
  { key: "volume", label: "Volume" },
  { key: "department_name", label: "Department" },
  { key: "item_types_label", label: "Item Types" },
  { key: "academic_year", label: "Year" },
  { key: "display", label: "Status", badge: true },
];

export default async function IndentBookPage() {
  const [rows, options] = await Promise.all([
    db
      .select()
      .from(indentBookT)
      .where(eq(indentBookT.display, "Y"))
      .orderBy(desc(indentBookT.id)),
    getBookOptions(),
  ]);

  const fields: FieldDef[] = [
    { name: "book_name", label: "Book Name", required: true, placeholder: "Indent Book — Computer Engineering" },
    { name: "book_no", label: "Book No", type: "number", placeholder: "Number printed on the cover" },
    { name: "volume", label: "Volume", type: "number", default: 1 },
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

  // CrudTable columns are plain keys, so the labels are resolved here; the raw
  // ids stay on the row for the edit dialog to read.
  const display = rows.map((r) => ({
    ...r,
    department_name: labelFor(r.department_id, options.departments),
    item_types_label: labelsFor(r.item_type_ids, options.itemTypes),
  }));

  return (
    <CrudTable
      apiKey="indent-book"
      title="Indent Book"
      columns={columns}
      rows={display}
      fields={fields}
    />
  );
}
