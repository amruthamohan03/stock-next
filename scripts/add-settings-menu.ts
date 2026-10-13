/**
 * Add the "Application Settings" menu entry, mapped to Super Admin only.
 *
 * Changing the app's name, logo and palette is an administrator's job, so
 * unlike the other module menus this one gets a single role mapping. role 1
 * bypasses the mapping anyway (the god-mode shortcut in getMenuForRole), but
 * the row is inserted so the entry shows up in role-menu admin as deliberate
 * rather than missing.
 *
 * Idempotent. Usage: npx tsx scripts/add-settings-menu.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

const SUPER_ADMIN = 1;

async function main() {
  const existing = await sql`SELECT id FROM menu_master_t WHERE url = 'settings' LIMIT 1`;
  let menuId: number;

  if (existing.length > 0) {
    menuId = Number(existing[0].id);
    console.log(`• "Application Settings" already exists (id ${menuId}) — left as is.`);
  } else {
    const [next] = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM menu_master_t`;
    menuId = Number(next.id);
    // Last in the sidebar: settings belong at the bottom, under the modules.
    const [order] = await sql`
      SELECT COALESCE(MAX(menu_order), 0) + 1 AS n FROM menu_master_t WHERE menu_level = 0
    `;
    await sql`
      INSERT INTO menu_master_t
        (id, menu_id, menu_order, menu_level, menu_name, url, text, icon, display)
      VALUES
        (${menuId}, ${menuId}, ${Number(order.n)}, 0, 'Application Settings', 'settings',
         'Application Settings', 'ti ti-settings', 'Y')
    `;
    console.log(`✔ Added "Application Settings" (id ${menuId}).`);
  }

  const has = await sql`
    SELECT id FROM role_menu_mapping_t
    WHERE role_id = ${SUPER_ADMIN} AND menu_id = ${menuId} LIMIT 1
  `;
  if (has.length > 0) {
    console.log("• Super Admin mapping already present.");
  } else {
    await sql`
      INSERT INTO role_menu_mapping_t
        (role_id, menu_id, can_view, can_add, can_edit, can_delete, can_approve)
      VALUES (${SUPER_ADMIN}, ${menuId}, 1, 1, 1, 1, 1)
    `;
    console.log("✔ Mapped to Super Admin.");
  }

  const check = await sql`
    SELECT m.id, m.menu_name, m.url, m.menu_order,
           string_agg(r.role_id::text, ',' ORDER BY r.role_id) AS roles
    FROM menu_master_t m
    LEFT JOIN role_menu_mapping_t r ON r.menu_id = m.id
    WHERE m.id = ${menuId}
    GROUP BY m.id, m.menu_name, m.url, m.menu_order
  `;
  console.table(check.map((r) => ({ ...r })));
  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
