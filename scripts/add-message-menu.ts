/**
 * Add a top-level "Messages" menu entry so the Compose page appears in the
 * sidebar. Idempotent — skips if a row with url='message' already exists.
 * Usage: npx tsx scripts/add-message-menu.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

async function main() {
  const existing = await sql`SELECT id FROM menu_master_t WHERE url = 'message' LIMIT 1`;
  if (existing.length > 0) {
    console.log("• 'Messages' menu already exists — nothing to do.");
    await sql.end();
    return;
  }
  const next = await sql`SELECT COALESCE(MAX(id),0)+1 AS id FROM menu_master_t`;
  const id = next[0].id;
  await sql`
    INSERT INTO menu_master_t (id, menu_id, menu_order, menu_level, menu_name, url, text, icon, display)
    VALUES (${id}, ${id}, 50, 0, 'Messages', 'message', 'Messages', 'ti ti-message', 'Y')
  `;
  console.log("✔ Added top-level 'Messages' menu entry.");
  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
