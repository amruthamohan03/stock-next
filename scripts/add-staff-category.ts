/**
 * Add staff_category to staff_t (additive; idempotent).
 * Usage: npx tsx scripts/add-staff-category.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

async function main() {
  await sql`ALTER TABLE staff_t ADD COLUMN IF NOT EXISTS staff_category varchar(20) DEFAULT 'FACULTY'`;
  console.log("✔ staff_t.staff_category is ready.");
  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
