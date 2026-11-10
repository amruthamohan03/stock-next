/**
 * Add the top-level "Chat" menu entry and give every active role access.
 *
 * The role mapping on this entry is what controls chat: can_view = use chat
 * (and appear as a contact), can_add = send messages, can_delete = delete own
 * messages. Narrow it per role afterwards on the Role-Menu Mapping screen.
 *
 * Idempotent. Usage: npx tsx scripts/add-chat-menu.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });
const URL_PATH = "chat";

async function main() {
  const existing = await sql`SELECT id FROM menu_master_t WHERE url = ${URL_PATH} LIMIT 1`;
  let menuId: number;
  if (existing.length > 0) {
    menuId = Number(existing[0].id);
    console.log(`• "Chat" already exists (id ${menuId}) — left as is.`);
  } else {
    const [next] = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM menu_master_t`;
    menuId = Number(next.id);
    // Next to Messages (order 50), before Application Settings (51).
    await sql`
      INSERT INTO menu_master_t
        (id, menu_id, menu_order, menu_level, menu_name, url, text, icon, display)
      VALUES (${menuId}, 0, 49, 0, 'Chat', ${URL_PATH}, 'Chat', 'ti ti-message-circle', 'Y')
    `;
    console.log(`✔ Added "Chat" (id ${menuId}) as a main menu.`);
  }

  const roles = await sql`SELECT id FROM role_master_t WHERE display = 'Y' ORDER BY id`;
  let added = 0;
  for (const { id: roleId } of roles) {
    const has = await sql`
      SELECT id FROM role_menu_mapping_t WHERE role_id = ${roleId} AND menu_id = ${menuId} LIMIT 1
    `;
    if (has.length > 0) continue;
    await sql`
      INSERT INTO role_menu_mapping_t
        (role_id, menu_id, can_view, can_add, can_edit, can_delete, can_approve)
      VALUES (${roleId}, ${menuId}, 1, 1, 0, 1, 0)
    `;
    added++;
  }
  console.log(`✔ Role mappings: ${added} added, ${roles.length - added} already present.`);
  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
