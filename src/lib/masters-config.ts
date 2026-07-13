import type { PgTable } from "drizzle-orm/pg-core";
import {
  makeT,
  modelT,
  departmentMasterT,
  serviceProvidersT,
  daybookUnitT,
  itemMasterT,
  groupItemNameMasterT,
  menuMasterT,
  roleMasterT,
  usersT,
  dashboardCardMasterT,
} from "@/db/schema";

export type MasterConfig = {
  table: PgTable;
  /** Columns a client is allowed to write (whitelist). */
  writable: string[];
  /** Columns that should be coerced to integers. */
  numeric?: string[];
  /** Columns bcrypt-hashed before writing (e.g. password). Blank = skipped,
   *  so on update an empty value keeps the existing hash. */
  hash?: string[];
  /** Columns that must be present & non-empty on create (POST). */
  requiredOnInsert?: string[];
  /** Columns whose value must be unique across the table (checked on create/update). */
  unique?: string[];
  /** Column values injected on create when not supplied (e.g. NOT NULL columns
   *  without a DB default that the form doesn't expose). */
  insertDefaults?: Record<string, unknown>;
};

/**
 * Server-side registry used by the generic /api/masters/[key] route.
 * The client field descriptors live alongside each page.
 */
export const MASTERS: Record<string, MasterConfig> = {
  make: {
    table: makeT,
    writable: ["make_name", "display"],
  },
  model: {
    table: modelT,
    writable: ["make_id", "model_name", "display"],
    numeric: ["make_id"],
  },
  department: {
    table: departmentMasterT,
    writable: ["department_name", "college_id", "display"],
    numeric: ["college_id"],
  },
  provider: {
    table: serviceProvidersT,
    writable: [
      "provider_name",
      "type",
      "phone_no",
      "email",
      "gst_no",
      "address",
      "display",
    ],
  },
  unit: {
    table: daybookUnitT,
    writable: ["name", "display"],
  },
  item: {
    table: itemMasterT,
    writable: ["item_name", "item_code", "category_id", "tax_not_tax", "display"],
    numeric: ["category_id"],
  },
  group: {
    table: groupItemNameMasterT,
    writable: ["group_name", "group_code", "display"],
  },
  menu: {
    table: menuMasterT,
    writable: [
      "menu_id",
      "menu_order",
      "menu_level",
      "menu_name",
      "url",
      "text",
      "icon",
      "badge",
      "display",
    ],
    numeric: ["menu_id", "menu_order", "menu_level"],
  },
  role: {
    table: roleMasterT,
    writable: [
      "role_name",
      "department_id",
      "office_location_id",
      "parent_role_id",
      "approval_level",
      "department",
      "management",
      "finance",
      "display",
    ],
    numeric: [
      "department_id",
      "office_location_id",
      "parent_role_id",
      "approval_level",
      "department",
      "management",
      "finance",
    ],
    requiredOnInsert: ["role_name"],
  },
  user: {
    table: usersT,
    // dept_id / location_id are varchar in the schema → NOT numeric (stored as-is).
    writable: [
      "username",
      "password",
      "email",
      "full_name",
      "role_id",
      "dept_id",
      "location_id",
      "display",
    ],
    numeric: ["role_id"],
    hash: ["password"],
    requiredOnInsert: ["username", "password"],
  },
  "dashboard-card": {
    table: dashboardCardMasterT,
    writable: [
      "card_key",
      "card_title",
      "card_subtitle",
      "card_icon",
      "card_color",
      "card_url",
      "card_order",
      "card_category",
      "menu_id",
      "data_source",
      "display",
    ],
    numeric: ["card_order", "menu_id"],
    requiredOnInsert: ["card_key", "card_title"],
    unique: ["card_key"],
    // card_content_id is NOT NULL with no DB default and isn't on the form.
    insertDefaults: { card_content_id: "" },
  },
};
