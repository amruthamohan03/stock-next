/**
 * Add signatory columns to kfc_form_13_t and document_t (additive; idempotent).
 * Usage: npx tsx scripts/add-signatory-columns.ts
 */
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

async function main() {
  await sql`ALTER TABLE kfc_form_13_t ADD COLUMN IF NOT EXISTS signed_by integer`;
  await sql`ALTER TABLE kfc_form_13_t ADD COLUMN IF NOT EXISTS signatory_name varchar(150)`;
  await sql`ALTER TABLE kfc_form_13_t ADD COLUMN IF NOT EXISTS signatory_designation varchar(150)`;
  await sql`ALTER TABLE document_t ADD COLUMN IF NOT EXISTS signed_by integer`;
  console.log("✔ signatory columns added.");
  await sql.end();
}
main().catch(async (e) => { console.error("✖ Failed:", e.message); await sql.end(); process.exit(1); });
