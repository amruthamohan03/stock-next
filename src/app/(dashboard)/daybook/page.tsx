import { aliasedTable, and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  daybookMasterT,
  daybookItemT,
  stockbookTypeT,
  serviceProvidersT,
  issuedToMasterT,
  usersT,
} from "@/db/schema";
import DaybookForm from "./daybook-form";
import DaybookTable from "./daybook-table";
import { getDaybookOptions } from "./options";

// Ports DaybookController::index — create form + list of Day Book entries.
export default async function DaybookPage() {
  const verifier = aliasedTable(usersT, "verifier");

  const rowsPromise = db
    .select({
      id: daybookMasterT.id,
      page_no: daybookMasterT.page_no,
      stockbook_name: stockbookTypeT.name,
      document_date: daybookMasterT.document_date,
      provider_name: serviceProvidersT.provider_name,
      issued_to_name: issuedToMasterT.location_name,
      invoice_ref: daybookMasterT.invoice_ref,
      verifier_name: verifier.full_name,
      receipt_lines: sql<number>`count(*) filter (where ${daybookItemT.transaction_type} = 'RECEIPT')::int`,
      issue_lines: sql<number>`count(*) filter (where ${daybookItemT.transaction_type} = 'ISSUE')::int`,
      total_receipt_amt: sql<number>`coalesce(sum(${daybookItemT.receipt_amount_rs}), 0)::float8`,
      total_issue_amt: sql<number>`coalesce(sum(${daybookItemT.issue_amount_rs}), 0)::float8`,
    })
    .from(daybookMasterT)
    .leftJoin(stockbookTypeT, eq(stockbookTypeT.id, daybookMasterT.stockbook_type_id))
    .leftJoin(serviceProvidersT, eq(serviceProvidersT.id, daybookMasterT.service_provider_id))
    .leftJoin(issuedToMasterT, eq(issuedToMasterT.id, daybookMasterT.issued_to_id))
    .leftJoin(verifier, eq(verifier.id, daybookMasterT.verifier_id))
    .leftJoin(
      daybookItemT,
      and(eq(daybookItemT.daybook_id, daybookMasterT.id), eq(daybookItemT.display, "Y"))
    )
    .where(eq(daybookMasterT.display, "Y"))
    .groupBy(
      daybookMasterT.id,
      daybookMasterT.page_no,
      stockbookTypeT.name,
      daybookMasterT.document_date,
      serviceProvidersT.provider_name,
      issuedToMasterT.location_name,
      daybookMasterT.invoice_ref,
      verifier.full_name
    )
    .orderBy(desc(daybookMasterT.document_date), desc(daybookMasterT.id));

  const [rows, options] = await Promise.all([rowsPromise, getDaybookOptions()]);

  return (
    <div className="space-y-6">
      <DaybookForm {...options} />
      <DaybookTable rows={rows} />
    </div>
  );
}
