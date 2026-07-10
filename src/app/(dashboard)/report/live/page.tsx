import { sql } from "drizzle-orm";
import { db } from "@/db";
import LiveStockTable, { type LiveStockRow } from "./live-stock-table";

// Ports LiveController::fetchLiveStockData. MySQL → Postgres notes:
//   GROUP_CONCAT(DISTINCT … SEPARATOR ', ')  →  string_agg(DISTINCT …, ', ')
//   SUM(int) comes back as bigint (a string via postgres.js) → coerce with Number().
export default async function LiveStockPage() {
  const result = await db.execute(sql`
    SELECT
      i.id                                                        AS item_id,
      i.item_name,
      COALESCE(SUM(sb.opening_balance), 0)                        AS opening_balance,
      COALESCE(SUM(sb.current_balance), 0)                        AS current_balance,
      COALESCE(SUM(CASE WHEN st.transaction_type = 'RECEIPT' THEN st.receipt_qty ELSE 0 END), 0) AS total_receipt,
      COALESCE(SUM(CASE WHEN st.transaction_type = 'ISSUE'   THEN st.issue_qty   ELSE 0 END), 0) AS total_issued,
      COALESCE(SUM(CASE WHEN st.item_status = 'WORKING'      THEN st.receipt_qty ELSE 0 END), 0) AS working_receipt,
      COALESCE(SUM(CASE WHEN st.item_status = 'NOT WORKING'  THEN st.receipt_qty ELSE 0 END), 0) AS not_working_receipt,
      COALESCE(SUM(CASE WHEN st.transaction_type = 'ISSUE'
                        AND st.issued_to_location_id IS NOT NULL
                        AND st.issued_to_location_id <> 0
                        THEN st.issue_qty ELSE 0 END), 0)         AS transferred_qty,
      string_agg(DISTINCT sb.location, ', ' ORDER BY sb.location) AS locations_list,
      MAX(st.transaction_date)                                    AS last_transaction_date
    FROM item_master_t i
    INNER JOIN stock_book_t sb        ON sb.item_id = i.id
    LEFT  JOIN stock_transaction_t st ON st.stock_book_id = sb.id
    WHERE i.display = 'Y' AND sb.display = 'Y'
    GROUP BY i.id, i.item_name
    ORDER BY i.item_name ASC
  `);

  // db.execute returns driver rows; normalize numeric aggregates (bigint → number).
  const raw = result as unknown as Record<string, unknown>[];
  const rows: LiveStockRow[] = raw.map((r) => ({
    item_id: Number(r.item_id),
    item_name: (r.item_name as string) ?? null,
    opening_balance: Number(r.opening_balance ?? 0),
    current_balance: Number(r.current_balance ?? 0),
    total_receipt: Number(r.total_receipt ?? 0),
    total_issued: Number(r.total_issued ?? 0),
    transferred_qty: Number(r.transferred_qty ?? 0),
    working_receipt: Number(r.working_receipt ?? 0),
    not_working_receipt: Number(r.not_working_receipt ?? 0),
    locations_list: (r.locations_list as string) ?? null,
    last_transaction_date: (r.last_transaction_date as string | Date) ?? null,
  }));

  return <LiveStockTable rows={rows} />;
}
