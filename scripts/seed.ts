/**
 * Minimal seed — makes the app usable without loading the full MySQL dump.
 * Idempotent: every insert uses onConflictDoNothing, so it is safe to run even
 * after `npm run db:load` (it simply skips rows that already exist).
 *
 * Default login after seeding:
 *   username: supadmin
 *   password: (the existing production password — the real bcrypt hash is kept)
 *
 * The hash below is copied verbatim from the original dump so existing
 * credentials keep working. If you don't know the password, set a new one:
 *   AUTH_RESET_PASSWORD=newpass npm run db:seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { db } from "../src/db/index";
import {
  roleMasterT,
  usersT,
  quotationCategoriesT,
  departmentMasterT,
  collegeT,
  menuMasterT,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/password";

const ORIGINAL_SUPADMIN_HASH =
  "$2y$10$n4ug2VJTNMVSWiuAQqwEROEbzVo7jFfMGM1klq0mQVCe0pZYsCgEW";

async function main() {
  console.log("Seeding core data…");

  await db.insert(collegeT).values({
    id: 1,
    college_name: "Government Polytechnic College Nedumkandam",
    created_by: 1,
    display: "Y",
  }).onConflictDoNothing();

  await db.insert(roleMasterT).values([
    { id: 1, role_name: "Super Admin", department: 1, management: 1, finance: 1, display: "Y" },
    { id: 41, role_name: "Principal", office_location_id: 1, display: "Y" },
    { id: 42, role_name: "Head of Department", parent_role_id: 41, display: "Y" },
    { id: 44, role_name: "Demonstrator", parent_role_id: 42, display: "Y" },
  ]).onConflictDoNothing();

  const password = process.env.AUTH_RESET_PASSWORD
    ? await hashPassword(process.env.AUTH_RESET_PASSWORD)
    : ORIGINAL_SUPADMIN_HASH;

  await db.insert(usersT).values({
    id: 1,
    username: "supadmin",
    password,
    email: "supadmin@gmail.com",
    full_name: "Admin",
    role_id: 1,
    display: "Y",
    created_by: 1,
  }).onConflictDoNothing();

  await db.insert(quotationCategoriesT).values([
    { id: 1, category_name: "Furniture", category_header: "Furniture", display_order: 1, display: "Y" },
    { id: 2, category_name: "Electronic Equipments", category_header: "Electronic Equipments", display_order: 2, display: "Y" },
    { id: 3, category_name: "Tools", category_header: "Tools", display_order: 0, display: "Y" },
  ]).onConflictDoNothing();

  await db.insert(departmentMasterT).values([
    { id: 1, college_id: 1, department_name: "Computer Engineering", created_by: 1, display: "Y" },
    { id: 2, college_id: 1, department_name: "Computer Hardware Engineering", created_by: 1, display: "Y" },
    { id: 3, college_id: 1, department_name: "Electronics Engineering", created_by: 1, display: "Y" },
  ]).onConflictDoNothing();

  // Sidebar menu — enough entries for the ported modules (Super Admin sees all).
  await db.insert(menuMasterT).values([
    { id: 1, menu_id: 1, menu_order: 1, menu_level: 0, menu_name: "Dashboard", url: "home/index", text: "Dashboard", icon: "ti ti-dashboard", display: "Y" },
    { id: 2, menu_id: 2, menu_order: 3, menu_level: 0, menu_name: "Stock Entry", url: "#", text: "Stock Management", icon: "ti ti-package", display: "Y" },
    { id: 3, menu_id: 2, menu_order: 2, menu_level: 0, menu_name: "Masters", url: "#", text: "Masters", icon: "ti ti-layout", display: "Y" },
    { id: 108, menu_id: 2, menu_order: 1, menu_level: 1, menu_name: "Intent Book", url: "indent", text: "Indent Book", display: "Y" },
    { id: 109, menu_id: 2, menu_order: 2, menu_level: 1, menu_name: "Stock", url: "stock", text: "Stock Ledger", display: "Y" },
    { id: 110, menu_id: 2, menu_order: 3, menu_level: 1, menu_name: "Day Book", url: "daybook", text: "Day Book", display: "Y" },
    { id: 37, menu_id: 3, menu_order: 21, menu_level: 1, menu_name: "Item", url: "item/index", text: "Item", display: "Y" },
    { id: 106, menu_id: 3, menu_order: 2, menu_level: 1, menu_name: "Make", url: "make", text: "Make", display: "Y" },
    { id: 107, menu_id: 3, menu_order: 4, menu_level: 1, menu_name: "Model", url: "model", text: "Model", display: "Y" },
    { id: 14, menu_id: 3, menu_order: 8, menu_level: 1, menu_name: "Department", url: "department/index", text: "Department", display: "Y" },
    { id: 111, menu_id: 3, menu_order: 4, menu_level: 1, menu_name: "Service Provider", url: "provider", text: "Service Provider", display: "Y" },
    { id: 200, menu_id: 3, menu_order: 30, menu_level: 1, menu_name: "Unit", url: "unit", text: "Unit", display: "Y" },
  ]).onConflictDoNothing();

  console.log("✔ Seed complete. Login as supadmin.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
