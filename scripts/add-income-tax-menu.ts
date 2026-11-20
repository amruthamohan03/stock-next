/**
 * Add the "Income Tax" (anticipatory income tax statement) menu entry.
 *
 * Statements hold every employee's salary and PAN, and users are not linked
 * to staff rows, so anyone mapped here sees all of them. Only the Principal is
 * mapped by default (Super Admin bypasses RBAC); grant other roles through the
 * Role-Menu Mapping page if the office prepares the statements. "Approve" on
 * this menu is the right to lock and unlock financial years.
 *
 * Idempotent. Usage: npx tsx scripts/add-income-tax-menu.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

const FULL_ROLES = [1, 41]; // Super Admin, Principal
const URL_PATH = "income-tax";
const NAME = "Income Tax";

async function main() {
  const existing = await sql`SELECT id FROM menu_master_t WHERE url = ${URL_PATH} LIMIT 1`;
  let menuId: number;

  if (existing.length > 0) {
    menuId = Number(existing[0].id);
    console.log(`• "${NAME}" already exists (id ${menuId}) — left as is.`);
  } else {
    const [next] = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM menu_master_t`;
    menuId = Number(next.id);
    await sql`
      INSERT INTO menu_master_t
        (id, menu_id, menu_order, menu_level, menu_name, url, text, icon, display)
      VALUES
        (${menuId}, ${menuId}, 10, 0, ${NAME}, ${URL_PATH},
         'Anticipatory Income Tax', 'ti ti-calculator', 'Y')
    `;
    console.log(`✔ Added "${NAME}" (id ${menuId}).`);
  }

  let added = 0;
  for (const roleId of FULL_ROLES) {
    const has = await sql`
      SELECT id FROM role_menu_mapping_t
      WHERE role_id = ${roleId} AND menu_id = ${menuId} LIMIT 1
    `;
    // can_approve = lock / unlock financial years.
    if (has.length > 0) {
      await sql`UPDATE role_menu_mapping_t SET can_approve = 1 WHERE id = ${has[0].id}`;
      continue;
    }
    await sql`
      INSERT INTO role_menu_mapping_t
        (role_id, menu_id, can_view, can_add, can_edit, can_delete, can_approve)
      VALUES (${roleId}, ${menuId}, 1, 1, 1, 1, 1)
    `;
    added++;
  }
  console.log(`✔ Role mappings: ${added} added, ${FULL_ROLES.length - added} already present.`);
  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
