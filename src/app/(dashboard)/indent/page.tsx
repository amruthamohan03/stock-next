import { desc, eq, sql, and } from "drizzle-orm";
import { db } from "@/db";
import {
  indentMasterT,
  departmentMasterT,
  indentItemT,
} from "@/db/schema";
import IndentTable from "./indent-table";

export default async function IndentPage() {
  const rows = await db
    .select({
      id: indentMasterT.id,
      indent_no: indentMasterT.indent_no,
      indent_date: indentMasterT.indent_date,
      purpose: indentMasterT.purpose,
      status: indentMasterT.status,
      item_type: indentMasterT.item_type,
      department_name: departmentMasterT.department_name,
      item_count: sql<number>`count(${indentItemT.id})::int`,
      total_qty: sql<number>`coalesce(sum(${indentItemT.qty_intended}),0)::int`,
    })
    .from(indentMasterT)
    .leftJoin(
      departmentMasterT,
      eq(indentMasterT.department_id, departmentMasterT.id)
    )
    .leftJoin(
      indentItemT,
      and(eq(indentItemT.indent_id, indentMasterT.id), eq(indentItemT.display, "Y"))
    )
    .where(eq(indentMasterT.display, "Y"))
    .groupBy(
      indentMasterT.id,
      indentMasterT.indent_no,
      indentMasterT.indent_date,
      indentMasterT.purpose,
      indentMasterT.status,
      indentMasterT.item_type,
      departmentMasterT.department_name
    )
    .orderBy(desc(indentMasterT.id));

  return <IndentTable rows={rows} />;
}
