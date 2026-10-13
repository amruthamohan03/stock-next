/**
 * Add the "Study Materials" menu entry and map it to the staff roles.
 *
 * Mirrors scripts/add-committee-event-menu.ts. Only the leaf menu gets
 * role_menu_mapping_t rows — getMenuForRole never treats a '#' parent as
 * allowed in its own right.
 *
 * Idempotent. Usage: npx tsx scripts/add-study-material-menu.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

/** Everyone teaching needs these; only the senior roles may delete. */
const FULL_ROLES = [1, 41, 42, 50]; // Super Admin, Principal, HoD, HoD (in-charge)
const EDIT_ROLES = [43, 44, 45]; // Lecturer, Demonstrator, Trade Instructor

async function main() {
  const existing = await sql`SELECT id FROM menu_master_t WHERE url = 'study-material' LIMIT 1`;
  let menuId: number;

  if (existing.length > 0) {
    menuId = Number(existing[0].id);
    console.log(`• "Study Materials" already exists (id ${menuId}) — left as is.`);
  } else {
    const [next] = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM menu_master_t`;
    menuId = Number(next.id);
    await sql`
      INSERT INTO menu_master_t
        (id, menu_id, menu_order, menu_level, menu_name, url, text, icon, display)
      VALUES
        (${menuId}, ${menuId}, 8, 0, 'Study Materials', 'study-material',
         'Study Materials', 'ti ti-book', 'Y')
    `;
    console.log(`✔ Added "Study Materials" (id ${menuId}).`);
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

  const check = await sql`
    SELECT m.id, m.menu_name, m.url, m.menu_order, count(r.id)::int AS roles
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
