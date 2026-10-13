/**
 * Add the "Committees & Events" menu branch and map it to the staff roles.
 *
 *   Committees & Events   (parent, url '#')
 *     ├── Committees      → committee  → /committee
 *     └── Events          → event      → /event
 *
 * Only the two leaf menus get role_menu_mapping_t rows. `getMenuForRole` keeps
 * a '#' parent when any child is visible and never treats the parent itself as
 * allowed, so a mapping on the parent would do nothing.
 *
 * Idempotent — re-running adds only what is missing.
 * Usage: npx tsx scripts/add-committee-event-menu.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db";
const sql = postgres(url, { max: 1 });

const PARENT_NAME = "Committees & Events";

/**
 * Who gets the branch. Full rights for the roles that run the festival;
 * the advisers and coordinators (Lecturer / Demonstrator / Trade Instructor)
 * can enter and correct data but not delete it.
 *
 * Change any of this later in the UI at /role-menu-mapping — these are just
 * sensible starting rights, not a fixed policy.
 */
const FULL_ROLES = [1, 41, 42, 50]; // Super Admin, Principal, HoD, HoD (in-charge)
const EDIT_ROLES = [43, 44, 45]; // Lecturer, Demonstrator, Trade Instructor

async function nextMenuId(): Promise<number> {
  const [row] = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM menu_master_t`;
  return Number(row.id);
}

/** Insert a menu row if its url (or name, for a '#' parent) is not already there. */
async function ensureMenu(opts: {
  name: string;
  url: string;
  parentId: number | null;
  level: number;
  order: number;
  icon: string;
}): Promise<number> {
  const existing =
    opts.url === "#"
      ? await sql`SELECT id FROM menu_master_t WHERE menu_name = ${opts.name} AND menu_level = 0 LIMIT 1`
      : await sql`SELECT id FROM menu_master_t WHERE url = ${opts.url} LIMIT 1`;

  if (existing.length > 0) {
    console.log(`• "${opts.name}" already exists (id ${existing[0].id}) — left as is.`);
    return Number(existing[0].id);
  }

  const id = await nextMenuId();
  // Top-level rows carry their own id in menu_id, children carry the parent's.
  const menuId = opts.parentId ?? id;
  await sql`
    INSERT INTO menu_master_t
      (id, menu_id, menu_order, menu_level, menu_name, url, text, icon, display)
    VALUES
      (${id}, ${menuId}, ${opts.order}, ${opts.level}, ${opts.name},
       ${opts.url}, ${opts.name}, ${opts.icon}, 'Y')
  `;
  console.log(`✔ Added "${opts.name}" (id ${id}, url '${opts.url}').`);
  return id;
}

/** Give a role rights on a menu, skipping roles that already have a row. */
async function ensureMapping(roleId: number, menuId: number, full: boolean) {
  const existing = await sql`
    SELECT id FROM role_menu_mapping_t
    WHERE role_id = ${roleId} AND menu_id = ${menuId} LIMIT 1
  `;
  if (existing.length > 0) return false;

  await sql`
    INSERT INTO role_menu_mapping_t
      (role_id, menu_id, can_view, can_add, can_edit, can_delete, can_approve)
    VALUES
      (${roleId}, ${menuId}, 1, 1, 1, ${full ? 1 : 0}, ${full ? 1 : 0})
  `;
  return true;
}

async function main() {
  const parentId = await ensureMenu({
    name: PARENT_NAME,
    url: "#",
    parentId: null,
    level: 0,
    order: 7,
    icon: "ti ti-confetti",
  });

  const committeeId = await ensureMenu({
    name: "Committees",
    url: "committee",
    parentId,
    level: 1,
    order: 1,
    icon: "ti ti-users-group",
  });

  const eventId = await ensureMenu({
    name: "Events",
    url: "event",
    parentId,
    level: 1,
    order: 2,
    icon: "ti ti-calendar-event",
  });

  let added = 0;
  for (const menuId of [committeeId, eventId]) {
    for (const roleId of FULL_ROLES) {
      if (await ensureMapping(roleId, menuId, true)) added++;
    }
    for (const roleId of EDIT_ROLES) {
      if (await ensureMapping(roleId, menuId, false)) added++;
    }
  }
  console.log(`✔ Role mappings: ${added} added, ${(FULL_ROLES.length + EDIT_ROLES.length) * 2 - added} already present.`);

  const check = await sql`
    SELECT m.id, m.menu_name, m.url, m.menu_level, m.menu_order,
           COUNT(r.id)::int AS roles
    FROM menu_master_t m
    LEFT JOIN role_menu_mapping_t r ON r.menu_id = m.id
    WHERE m.id IN (${parentId}, ${committeeId}, ${eventId})
    GROUP BY m.id, m.menu_name, m.url, m.menu_level, m.menu_order
    ORDER BY m.menu_level, m.menu_order
  `;
  console.table(check.map((r) => ({ ...r })));

  await sql.end();
}

main().catch(async (e) => {
  console.error("✖ Failed:", e.message);
  await sql.end();
  process.exit(1);
});
