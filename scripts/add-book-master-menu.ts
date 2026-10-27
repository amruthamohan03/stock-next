/**
 * Add the "Indent Book" and "Stock Book" master menus under Masters, and seed
 * the one indent book the existing indents already refer to.
 *
 * Every indent in the database carries book_no = 1, which is now the id of a
 * row in indent_book_t. Seeding that row at id 1 keeps those 62 indents
 * pointing at a real book instead of a dangling number — without it the indent
 * form would show "Book 1 (not in master)" for all of them.
 *
 * Idempotent. Usage: npx tsx scripts/add-book-master-menu.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

/** Masters is a parent menu ('#'), so only these leaves get role mappings. */
const MASTERS_URL = "masters";
const FULL_ROLES = [1, 41, 42, 50]; // Super Admin, Principal, HoD, HoD (in-charge)
const EDIT_ROLES = [43, 44, 45]; // Lecturer, Demonstrator, Trade Instructor

const MENUS = [
  { name: "Indent Book", url: "indent-book", icon: "ti ti-notebook" },
  { name: "Stock Book", url: "stock-book", icon: "ti ti-book-2" },
];

async function main() {
  const [parent] = await sql`
    SELECT id FROM menu_master_t
    WHERE lower(menu_name) = 'masters' AND menu_level = 0 AND display = 'Y'
    LIMIT 1
  `;
  if (!parent) {
    console.error(`✖ Parent menu "${MASTERS_URL}" not found.`);
    await sql.end();
    process.exit(1);
  }
  const parentId = Number(parent.id);

  const [{ n }] = await sql`
    SELECT COALESCE(MAX(menu_order), 0) AS n FROM menu_master_t
    WHERE menu_id = ${parentId} AND menu_level = 1
  `;
  let order = Number(n);

  for (const m of MENUS) {
    const existing = await sql`SELECT id FROM menu_master_t WHERE url = ${m.url} LIMIT 1`;
    let menuId: number;

    if (existing.length > 0) {
      menuId = Number(existing[0].id);
      console.log(`• "${m.name}" already exists (id ${menuId}) — left as is.`);
    } else {
      const [next] = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM menu_master_t`;
      menuId = Number(next.id);
      order++;
      await sql`
        INSERT INTO menu_master_t
          (id, menu_id, menu_order, menu_level, menu_name, url, text, icon, display)
        VALUES
          (${menuId}, ${parentId}, ${order}, 1, ${m.name}, ${m.url},
           ${m.name}, ${m.icon}, 'Y')
      `;
      console.log(`✔ Added "${m.name}" (id ${menuId}) under Masters.`);
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
    console.log(`  role mappings: ${added} added, ${total - added} already present.`);
  }

  // ---- the indent book every existing indent points at -------------------
  const [book] = await sql`SELECT id, book_name FROM indent_book_t WHERE id = 1 LIMIT 1`;
  if (book) {
    console.log(`• Indent book 1 already exists — "${book.book_name}".`);
  } else {
    const [{ c }] = await sql`SELECT count(*)::int AS c FROM indent_master_t WHERE book_no = 1`;
    await sql`
      INSERT INTO indent_book_t
        (id, book_name, book_no, volume, department_id, item_type_ids, display)
      VALUES
        (1, 'General Indent Book', 1, 1, NULL, '1,2', 'Y')
    `;
    // Keep the identity sequence ahead of the explicit id, or the next insert
    // from the UI collides with it.
    await sql`SELECT setval(pg_get_serial_sequence('indent_book_t', 'id'), (SELECT MAX(id) FROM indent_book_t))`;
    console.log(`✔ Seeded indent book 1 ("General Indent Book") — ${c} indents refer to it.`);
  }

  console.table(
    (
      await sql`
        SELECT m.id, m.menu_name, m.url, m.menu_order,
               string_agg(r.role_id::text, ',' ORDER BY r.role_id) AS roles
        FROM menu_master_t m
        LEFT JOIN role_menu_mapping_t r ON r.menu_id = m.id
        WHERE m.url IN ('indent-book', 'stock-book')
        GROUP BY m.id, m.menu_name, m.url, m.menu_order
        ORDER BY m.menu_order
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
