/**
 * Add the "Location" master menu under Masters.
 *
 * The table behind it (issued_to_master_t) already holds the college's
 * locations and is referenced by the stock ledger, so nothing is seeded here —
 * only the menu entry and its role mappings.
 *
 * Idempotent. Usage: npx tsx scripts/add-location-menu.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

const FULL_ROLES = [1, 41, 42, 50]; // Super Admin, Principal, HoD, HoD (in-charge)
const EDIT_ROLES = [43, 44, 45]; // Lecturer, Demonstrator, Trade Instructor

async function main() {
  const [parent] = await sql`
    SELECT id FROM menu_master_t
    WHERE lower(menu_name) = 'masters' AND menu_level = 0 AND display = 'Y'
    LIMIT 1
  `;
  if (!parent) {
    console.error("✖ Parent menu 'Masters' not found.");
    await sql.end();
    process.exit(1);
  }
  const parentId = Number(parent.id);

  const existing = await sql`SELECT id FROM menu_master_t WHERE url = 'location' LIMIT 1`;
  let menuId: number;

  if (existing.length > 0) {
    menuId = Number(existing[0].id);
    console.log(`• "Location" already exists (id ${menuId}) — left as is.`);
  } else {
    const [next] = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM menu_master_t`;
    menuId = Number(next.id);
    const [{ n }] = await sql`
      SELECT COALESCE(MAX(menu_order), 0) + 1 AS n FROM menu_master_t
      WHERE menu_id = ${parentId} AND menu_level = 1
    `;
    await sql`
      INSERT INTO menu_master_t
        (id, menu_id, menu_order, menu_level, menu_name, url, text, icon, display)
      VALUES
        (${menuId}, ${parentId}, ${Number(n)}, 1, 'Location', 'location',
         'Location', 'ti ti-map-pin', 'Y')
    `;
    console.log(`✔ Added "Location" (id ${menuId}) under Masters.`);
  }

  let added = 0;
  for (const [roles, full] of [[FULL_ROLES, true], [EDIT_ROLES, false]] as const) {
    for (const roleId of roles) {
      const has = await sql`
        SELECT id FROM role_menu_mapping_t
        WHERE role_id = ${roleId} AND menu_id = ${menuId} LIMIT 1
      `;
      if (has.length > 0) continue;
      await sql`
        INSERT INTO role_menu_mapping_t
          (role_id, menu_id, can_view, can_add, can_edit, can_delete, can_approve)
        VALUES (${roleId}, ${menuId}, 1, 1, 1, ${full ? 1 : 0}, ${full ? 1 : 0})
      `;
      added++;
    }
  }
  const total = FULL_ROLES.length + EDIT_ROLES.length;
  console.log(`✔ Role mappings: ${added} added, ${total - added} already present.`);

  console.table(
    (
      await sql`
        SELECT m.id, m.menu_name, m.url, m.menu_order,
               string_agg(r.role_id::text, ',' ORDER BY r.role_id) AS roles,
               (SELECT count(*)::int FROM issued_to_master_t WHERE display = 'Y') AS locations
        FROM menu_master_t m
        LEFT JOIN role_menu_mapping_t r ON r.menu_id = m.id
        WHERE m.id = ${menuId}
        GROUP BY m.id, m.menu_name, m.url, m.menu_order
      `
    ).map((r) => ({ ...r }))
  );
  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
