/**
 * Add bill-attachment columns to indent_master_t (additive; idempotent).
 * Usage: npx tsx scripts/add-indent-bill-columns.ts
 */
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });
async function main() {
  await sql`ALTER TABLE indent_master_t ADD COLUMN IF NOT EXISTS bill_path varchar(255)`;
  await sql`ALTER TABLE indent_master_t ADD COLUMN IF NOT EXISTS bill_name varchar(255)`;
  await sql`ALTER TABLE indent_master_t ADD COLUMN IF NOT EXISTS bill_type varchar(100)`;
  console.log("✔ indent bill columns added.");
  await sql.end();
}
main().catch(async (e) => { console.error("✖ Failed:", e.message); await sql.end(); process.exit(1); });
