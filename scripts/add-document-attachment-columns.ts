/**
 * Add attachment columns to document_t (additive; idempotent).
 * Usage: npx tsx scripts/add-document-attachment-columns.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

async function main() {
  await sql`ALTER TABLE document_t ADD COLUMN IF NOT EXISTS attachment_path varchar(255)`;
  await sql`ALTER TABLE document_t ADD COLUMN IF NOT EXISTS attachment_name varchar(255)`;
  await sql`ALTER TABLE document_t ADD COLUMN IF NOT EXISTS attachment_type varchar(100)`;
  console.log("✔ document_t attachment columns are ready.");
  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
