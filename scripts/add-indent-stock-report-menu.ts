/**
 * Add the "Indent → Stock" report menu under Reports and Submissions.
 *
 * Idempotent. Usage: npx tsx scripts/add-indent-stock-report-menu.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

const FULL_ROLES = [1, 41, 42, 50]; // Super Admin, Principal, HoD, HoD (in-charge)
const EDIT_ROLES = [43, 44, 45]; // Lecturer, Demonstrator, Trade Instructor
const URL_PATH = "report/indent-stock";

async function main() {
  const [parent] = await sql`
    SELECT id FROM menu_master_t
    WHERE menu_name ILIKE '%report%' AND menu_level = 0 AND display = 'Y'
    ORDER BY menu_order LIMIT 1
  `;
  if (!parent) {
    console.error("✖ Reports parent menu not found.");
    await sql.end();
    process.exit(1);
  }
  const parentId = Number(parent.id);

  const existing = await sql`SELECT id FROM menu_master_t WHERE url = ${URL_PATH} LIMIT 1`;
  let menuId: number;

  if (existing.length > 0) {
    menuId = Number(existing[0].id);
    console.log(`• "Indent → Stock" already exists (id ${menuId}) — left as is.`);
  } else {
    const [next] = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM menu_master_t`;
    menuId = Number(next.id);
    // After Custom Report (order 3), before the KFC forms.
    await sql`
      INSERT INTO menu_master_t
        (id, menu_id, menu_order, menu_level, menu_name, url, text, icon, display)
      VALUES
        (${menuId}, ${parentId}, 4, 1, 'Indent → Stock', ${URL_PATH},
         'Indent → Stock', 'ti ti-arrows-exchange', 'Y')
    `;
    console.log(`✔ Added "Indent → Stock" (id ${menuId}) under Reports.`);
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
        VALUES (${roleId}, ${menuId}, 1, 0, 0, ${full ? 1 : 0}, 0)
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
               string_agg(r.role_id::text, ',' ORDER BY r.role_id) AS roles
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
