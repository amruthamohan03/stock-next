/**
 * Drizzle schema — PostgreSQL port of the MariaDB `stock_db` dump.
 *
 * Conventions:
 *  - Table & column names are kept IDENTICAL to the original MySQL dump so the
 *    real data can be loaded via scripts/mysql-to-pg.mjs without remapping.
 *  - MySQL `enum('Y','N')` -> varchar (values preserved).
 *  - `tinyint(1)` -> integer (0/1 preserved).
 *  - AUTO_INCREMENT PKs -> `generatedByDefaultAsIdentity()` so explicit ids from
 *    the seed load succeed; run scripts/fix-sequences after loading.
 *  - Foreign keys are intentionally omitted (the source used MyISAM without
 *    enforced FKs); relations are resolved at the query/app layer.
 */
import {
  pgTable,
  integer,
  bigint,
  varchar,
  text,
  numeric,
  date,
  timestamp,
  char,
} from "drizzle-orm/pg-core";

const pk = () => integer().primaryKey().generatedByDefaultAsIdentity();
const bigPk = () => bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity();
const createdAt = () => timestamp({ withTimezone: false }).defaultNow();
const updatedAt = () => timestamp({ withTimezone: false }).defaultNow();

/* ------------------------------------------------------------------ auth / rbac */

export const usersT = pgTable("users_t", {
  id: pk(),
  username: varchar({ length: 255 }).notNull(),
  password: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 100 }).notNull(),
  mobile: varchar({ length: 15 }),
  full_name: varchar({ length: 255 }).notNull(),
  role_id: integer().notNull(),
  display: varchar({ length: 1 }).default("Y"),
  created_by: integer(),
  updated_by: integer(),
  created_at: createdAt(),
  updated_at: updatedAt(),
  profile_image: varchar({ length: 255 }).default("default.jpg"),
  signature_image: varchar({ length: 150 }),
  location_id: varchar({ length: 100 }),
  dept_id: varchar({ length: 100 }),
});

export const roleMasterT = pgTable("role_master_t", {
  id: pk(),
  role_name: varchar({ length: 100 }).notNull(),
  department_id: integer(),
  office_location_id: integer(),
  parent_role_id: integer(),
  approval_level: integer(),
  department: integer().default(0),
  management: integer().default(0),
  finance: integer().default(0),
  created_at: createdAt(),
  updated_at: updatedAt(),
  created_by: integer(),
  updated_by: integer(),
  display: varchar({ length: 1 }).default("Y"),
  level: numeric({ precision: 10, scale: 2 }),
});

export const menuMasterT = pgTable("menu_master_t", {
  id: pk(),
  menu_id: integer(),
  menu_order: integer().notNull().default(1),
  menu_level: integer(),
  menu_name: varchar({ length: 255 }),
  url: varchar({ length: 255 }),
  text: varchar({ length: 100 }),
  icon: varchar({ length: 100 }).default("  "),
  badge: varchar({ length: 50 }).default("  "),
  created_at: createdAt(),
  updated_at: updatedAt(),
  created_by: integer(),
  updated_by: integer(),
  display: varchar({ length: 1 }).default("Y"),
});

export const roleMenuMappingT = pgTable("role_menu_mapping_t", {
  id: bigPk(),
  role_id: bigint({ mode: "number" }).notNull(),
  menu_id: bigint({ mode: "number" }).notNull(),
  can_view: integer().default(0),
  can_add: integer().default(0),
  can_edit: integer().default(0),
  can_delete: integer().default(0),
  can_approve: integer().default(0),
  created_at: createdAt(),
  updated_at: updatedAt(),
  created_by: bigint({ mode: "number" }),
  updated_by: bigint({ mode: "number" }),
});

export const dashboardCardMasterT = pgTable("dashboard_card_master_t", {
  id: pk(),
  card_key: varchar({ length: 50 }).notNull(),
  card_content_id: varchar({ length: 50 }).notNull(),
  card_title: varchar({ length: 100 }).notNull(),
  card_subtitle: varchar({ length: 100 }),
  card_icon: varchar({ length: 50 }).default("bi-card-text"),
  card_color: varchar({ length: 30 }).default("primary"),
  card_url: varchar({ length: 255 }),
  card_order: integer().default(0),
  card_category: varchar({ length: 50 }).default("general"),
  menu_id: integer().notNull().default(0),
  data_source: varchar({ length: 255 }),
  display: char({ length: 1 }).default("Y"),
  created_at: createdAt(),
  updated_at: updatedAt(),
  created_by: integer(),
  updated_by: integer(),
});

export const roleDashboardCardMappingT = pgTable("role_dashboard_card_mapping_t", {
  id: pk(),
  role_id: integer().notNull(),
  card_id: integer().notNull(),
  menu_id: integer().notNull().default(0),
  is_visible: integer().default(1),
  card_order: integer().default(0),
  created_at: createdAt(),
  updated_at: updatedAt(),
  created_by: integer(),
});

/* ------------------------------------------------------------------ org masters */

export const collegeT = pgTable("college_t", {
  id: pk(),
  college_name: varchar({ length: 255 }).notNull(),
  created_by: integer().notNull(),
  updated_by: integer(),
  display: varchar({ length: 1 }).default("Y"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const departmentMasterT = pgTable("department_master_t", {
  id: pk(),
  college_id: integer().notNull().default(1),
  department_name: varchar({ length: 100 }).notNull(),
  created_at: createdAt(),
  updated_at: updatedAt(),
  created_by: integer(),
  updated_by: integer(),
  display: varchar({ length: 1 }).default("Y"),
});

/* ------------------------------------------------------------------ item masters */

export const itemMasterT = pgTable("item_master_t", {
  id: bigPk(),
  item_name: varchar({ length: 255 }).notNull(),
  item_code: varchar({ length: 50 }),
  group_id: bigint({ mode: "number" }),
  category_id: integer().notNull().default(0),
  created_at: createdAt(),
  updated_at: updatedAt(),
  created_by: integer(),
  updated_by: integer(),
  display: varchar({ length: 1 }).default("Y"),
  tax_not_tax: varchar({ length: 1 }).notNull().default("N"),
});

export const groupItemNameMasterT = pgTable("group_item_name_master_t", {
  id: bigPk(),
  group_name: varchar({ length: 255 }).notNull(),
  group_code: varchar({ length: 50 }),
  created_at: createdAt(),
  updated_at: updatedAt(),
  created_by: integer(),
  updated_by: integer(),
  display: varchar({ length: 1 }).default("Y"),
});

export const itemGroupMasterT = pgTable("item_group_master_t", {
  id: pk(),
  group_name: varchar({ length: 255 }).notNull(),
  description: text(),
  display: varchar({ length: 1 }).default("Y"),
  created_by: integer(),
  updated_by: integer(),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const itemGroupT = pgTable("item_group_t", {
  id: pk(),
  group_name: varchar({ length: 150 }).notNull(),
  group_code: varchar({ length: 50 }),
  description: text(),
  display: varchar({ length: 1 }).default("Y"),
  created_by: integer().notNull(),
  updated_by: integer(),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const quotationCategoriesT = pgTable("quotation_categories_t", {
  id: pk(),
  category_name: varchar({ length: 100 }).notNull(),
  category_header: varchar({ length: 255 }).notNull(),
  display_order: integer().notNull().default(0),
  display: varchar({ length: 1 }).default("Y"),
  created_at: createdAt(),
  updated_at: updatedAt(),
  created_by: integer(),
  updated_by: integer(),
});

export const makeT = pgTable("make_t", {
  id: pk(),
  make_name: varchar({ length: 255 }).notNull(),
  created_by: integer().notNull(),
  updated_by: integer(),
  display: varchar({ length: 1 }).default("Y"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const modelT = pgTable("model_t", {
  id: pk(),
  make_id: integer().notNull(),
  model_name: varchar({ length: 255 }).notNull(),
  created_by: integer().notNull(),
  updated_by: integer(),
  display: varchar({ length: 1 }).default("Y"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const serviceProvidersT = pgTable("service_providers_t", {
  id: pk(),
  provider_name: varchar({ length: 255 }).notNull(),
  type: varchar({ length: 10 }).notNull(),
  phone_no: varchar({ length: 20 }).notNull(),
  email: varchar({ length: 255 }).notNull(),
  gst_no: varchar({ length: 15 }),
  address: text().notNull(),
  created_by: integer().notNull(),
  updated_by: integer(),
  created_at: createdAt(),
  updated_at: updatedAt(),
  display: varchar({ length: 1 }).default("Y"),
});

export const issuedToMasterT = pgTable("issued_to_master_t", {
  id: pk(),
  location_code: varchar({ length: 50 }).notNull(),
  location_name: varchar({ length: 255 }).notNull(),
  description: text(),
  contact_person: varchar({ length: 100 }),
  phone: varchar({ length: 20 }),
  display: varchar({ length: 1 }).default("Y"),
  created_by: integer(),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const statusMasterT = pgTable("status_master_t", {
  id: pk(),
  status_name: varchar({ length: 100 }).notNull(),
  created_at: createdAt(),
  created_by: integer(),
  updated_at: timestamp({ withTimezone: false }),
  updated_by: integer(),
});

export const languageTranslationT = pgTable("language_translation_t", {
  id: bigPk(),
  label: varchar({ length: 255 }).notNull(),
  english: text(),
  french: text(),
  module_id: integer(),
  created_at: createdAt(),
  updated_at: updatedAt(),
  created_by: integer(),
  updated_by: integer(),
  display: varchar({ length: 1 }).default("Y"),
});

/* ------------------------------------------------------------------ daybook */

export const daybookItemTypeT = pgTable("daybook_item_type_t", {
  id: pk(),
  name: varchar({ length: 100 }).notNull(),
  display: varchar({ length: 1 }).notNull().default("Y"),
  created_at: createdAt(),
});

export const daybookItemCategoryT = pgTable("daybook_item_category_t", {
  id: pk(),
  name: varchar({ length: 150 }).notNull(),
  item_type_id: integer().notNull(),
  display: varchar({ length: 1 }).notNull().default("Y"),
  created_at: createdAt(),
});

export const daybookUnitT = pgTable("daybook_unit_t", {
  id: pk(),
  name: varchar({ length: 50 }).notNull(),
  display: varchar({ length: 1 }).notNull().default("Y"),
});

export const daybookMasterT = pgTable("daybook_master_t", {
  id: pk(),
  page_no: varchar({ length: 20 }).notNull(),
  stockbook_type_id: integer().notNull(),
  institution_id: integer(),
  department_id: integer(),
  class: varchar({ length: 100 }),
  unit_label: varchar({ length: 100 }),
  receipt_order_no: varchar({ length: 100 }),
  document_date: date().notNull(),
  service_provider_id: integer().notNull(),
  invoice_ref: varchar({ length: 150 }),
  invoice_date: date(),
  indent_no: varchar({ length: 100 }),
  indent_date: date(),
  issued_to: varchar({ length: 150 }),
  cr_voucher_ref: varchar({ length: 100 }),
  verifier_id: integer(),
  remarks: text(),
  status: varchar({ length: 20 }).notNull().default("ACTIVE"),
  created_by: integer(),
  created_at: createdAt(),
  updated_at: updatedAt(),
  issued_to_id: integer(),
  display: varchar({ length: 1 }).default("Y"),
});

export const daybookItemT = pgTable("daybook_item_t", {
  id: pk(),
  daybook_id: integer().notNull(),
  sl_no: integer().notNull().default(1),
  transaction_type: varchar({ length: 10 }).notNull().default("RECEIPT"),
  item_id: integer().notNull(),
  item_description: varchar({ length: 300 }).notNull(),
  item_type_id: integer(),
  item_category_id: integer(),
  unit_id: integer(),
  issued_to_id: integer(),
  receipt_qty_number: numeric({ precision: 12, scale: 3 }).default("0"),
  receipt_qty_weight: numeric({ precision: 12, scale: 3 }).default("0"),
  issue_qty_number: numeric({ precision: 12, scale: 3 }).default("0"),
  issue_qty_weight: numeric({ precision: 12, scale: 3 }).default("0"),
  balance_qty_number: numeric({ precision: 12, scale: 3 }).default("0"),
  balance_qty_weight: numeric({ precision: 12, scale: 3 }).default("0"),
  receipt_rate: numeric({ precision: 12, scale: 2 }).default("0"),
  receipt_amount_rs: numeric({ precision: 12, scale: 2 }).default("0"),
  receipt_amount_ps: numeric({ precision: 6, scale: 2 }).default("0"),
  issue_rate: numeric({ precision: 12, scale: 2 }).default("0"),
  issue_amount_rs: numeric({ precision: 12, scale: 2 }).default("0"),
  issue_amount_ps: numeric({ precision: 6, scale: 2 }).default("0"),
  balance_rate: numeric({ precision: 12, scale: 2 }).default("0"),
  balance_amount_rs: numeric({ precision: 12, scale: 2 }).default("0"),
  balance_amount_ps: numeric({ precision: 6, scale: 2 }).default("0"),
  value_verifier: varchar({ length: 50 }),
  indent_no: varchar({ length: 100 }),
  indent_date: date(),
  created_at: createdAt(),
  updated_at: updatedAt(),
  display: varchar({ length: 1 }).default("Y"),
});

/* ------------------------------------------------------------------ indent */

export const indentMasterT = pgTable("indent_master_t", {
  id: pk(),
  department_id: integer().notNull().default(1),
  institution_id: integer().notNull().default(1),
  book_no: integer().notNull(),
  indent_no: varchar({ length: 50 }).notNull(),
  indent_date: date().notNull(),
  purpose: text(),
  item_type: varchar({ length: 1 }).default("N"),
  created_by: integer().notNull(),
  verified_by: integer(),
  passed_by: integer(),
  issued_by: integer(),
  received_by: integer(),
  status: varchar({ length: 20 }).default("CREATED"),
  created_at: createdAt(),
  updated_at: updatedAt(),
  display: varchar({ length: 1 }).default("Y"),
});

export const indentItemT = pgTable("indent_item_t", {
  id: pk(),
  indent_id: integer().notNull(),
  sl_no: integer().notNull(),
  item_id: integer().notNull(),
  group_id: integer(),
  make_id: integer(),
  model_id: integer(),
  item_description: varchar({ length: 1000 }),
  item_purpose: varchar({ length: 255 }),
  qty_intended: integer().notNull(),
  qty_passed: integer().default(0),
  qty_issued: integer().default(0),
  remarks: varchar({ length: 255 }),
  stock_book_page_no: integer(),
  stock_book_volume: integer(),
  day_book_page_no: integer(),
  day_book_volume: integer(),
  display: varchar({ length: 1 }).default("Y"),
  status_id: integer().notNull().default(1),
  created_at: createdAt(),
});

/* ------------------------------------------------------------------ stock */

export const stockbookTypeT = pgTable("stockbook_type_t", {
  id: pk(),
  name: varchar({ length: 100 }).notNull(),
  code: varchar({ length: 20 }).notNull(),
  display: varchar({ length: 1 }).notNull().default("Y"),
  created_at: createdAt(),
});

export const stockBookT = pgTable("stock_book_t", {
  id: pk(),
  item_id: integer().notNull(),
  location: varchar({ length: 100 }).notNull(),
  location_id: integer().notNull().default(1),
  opening_balance: integer().default(0),
  current_balance: integer().default(0),
  created_by: integer(),
  updated_by: integer(),
  created_at: createdAt(),
  updated_at: updatedAt(),
  display: varchar({ length: 1 }).default("Y"),
  serial_tracking_enabled: varchar({ length: 1 }).default("N"),
});

export const stockEntryBatchT = pgTable("stock_entry_batch_t", {
  id: pk(),
  batch_code: varchar({ length: 100 }).notNull(),
  entry_type: varchar({ length: 20 }).notNull(),
  batch_status: varchar({ length: 20 }).default("DRAFT"),
  item_count: integer().default(0),
  total_quantity: integer().default(0),
  batch_date: date().notNull(),
  notes: text(),
  created_by: integer().notNull(),
  verified_by: integer(),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const stockTransactionT = pgTable("stock_transaction_t", {
  id: pk(),
  institution_id: integer().notNull().default(1),
  department_id: integer().notNull().default(1),
  stock_book_id: integer().notNull(),
  transaction_date: date().notNull(),
  transaction_type: varchar({ length: 20 }).notNull(),
  stock_entry_type: varchar({ length: 20 }).default("INDENT_BASED"),
  item_type: varchar({ length: 20 }).default("CONSUMABLE"),
  item_category: varchar({ length: 100 }),
  book_volume: integer().default(1),
  voucher_no: varchar({ length: 50 }),
  voucher_date: date(),
  indent_id: integer(),
  indent_item_id: integer(),
  group_item_id: integer(),
  transfer_item_id: bigint({ mode: "number" }),
  received_from: varchar({ length: 200 }),
  issued_to: varchar({ length: 200 }),
  issued_to_location_id: integer(),
  transferred_from_location_id: integer(),
  receipt_qty: integer().default(0),
  issue_qty: integer().default(0),
  balance_qty: integer().notNull(),
  brought_forward: integer().default(0),
  carried_over: integer().default(0),
  item_status: varchar({ length: 20 }).default("WORKING"),
  make: varchar({ length: 100 }),
  model: varchar({ length: 100 }),
  description: text(),
  serial_no: varchar({ length: 100 }),
  receiver_initial: varchar({ length: 100 }),
  remarks: text(),
  batch_code: varchar({ length: 200 }),
  verification_status: varchar({ length: 20 }).default("PENDING"),
  verified_by: integer(),
  verified_at: timestamp({ withTimezone: false }),
  created_by: integer(),
  updated_by: integer(),
  created_at: createdAt(),
  updated_at: updatedAt(),
  display: varchar({ length: 1 }).default("Y"),
});

export const stockEntryLogT = pgTable("stock_entry_log_t", {
  id: pk(),
  stock_transaction_id: integer().notNull(),
  action: varchar({ length: 50 }).notNull(),
  old_values: text(),
  new_values: text(),
  action_by: integer().notNull(),
  action_reason: text(),
  created_at: createdAt(),
  display: varchar({ length: 1 }).notNull().default("Y"),
});

export const stockSerialTrackingT = pgTable("stock_serial_tracking_t", {
  id: pk(),
  stock_transaction_id: integer().notNull(),
  stock_book_id: integer().notNull(),
  serial_no: varchar({ length: 100 }).notNull(),
  item_status: varchar({ length: 20 }).default("WORKING"),
  issued_to_location_id: integer(),
  issued_date: date(),
  issue_remarks: text(),
  created_by: integer(),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const stockTransferDetailT = pgTable("stock_transfer_detail_t", {
  id: pk(),
  stock_transaction_id: integer().notNull(),
  source_location_id: integer().notNull(),
  destination_location_id: integer().notNull(),
  quantity_transferred: integer().notNull(),
  condition_status: varchar({ length: 50 }).default("GOOD"),
  transfer_reason: text(),
  created_at: createdAt(),
  display: varchar({ length: 1 }).notNull().default("Y"),
});

/* ------------------------------------------------------------------ customs (legacy, unused by UI) */

export const licensesT = pgTable("licenses_t", {
  id: pk(),
  license_number: varchar({ length: 50 }).notNull(),
  bank_id: integer(),
  client_id: integer().notNull(),
  license_cleared_by: integer(),
  entry_post_id: integer(),
  ref_cod: varchar({ length: 50 }),
  type_of_goods_id: integer().notNull(),
  weight: numeric({ precision: 10, scale: 2 }),
  m3: numeric({ precision: 10, scale: 2 }),
  unit_of_measurement_id: integer(),
  fob_declared: numeric({ precision: 15, scale: 2 }),
  insurance: numeric({ precision: 15, scale: 2 }),
  freight: numeric({ precision: 15, scale: 2 }),
  other_costs: numeric({ precision: 15, scale: 2 }),
  transport_mode_id: integer().notNull(),
  invoice_number: varchar({ length: 50 }),
  invoice_file: varchar({ length: 255 }),
  invoice_date: date(),
  currency_id: integer().notNull(),
  supplier: varchar({ length: 255 }),
  license_applied_date: date(),
  license_validation_date: date(),
  license_expiry_date: date(),
  license_file: varchar({ length: 255 }),
  kind_id: integer(),
  payment_method_id: integer(),
  payment_subtype_id: integer(),
  destination_id: integer(),
  fsi: varchar({ length: 100 }),
  aur: varchar({ length: 100 }),
  status: varchar({ length: 20 }).default("ACTIVE"),
  created_by: integer(),
  updated_by: integer(),
  created_at: timestamp({ withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: false }).notNull().defaultNow(),
  display: varchar({ length: 1 }).notNull().default("Y"),
  fob_currency_id: integer().default(1),
  insurance_currency_id: integer().default(1),
  freight_currency_id: integer().default(1),
  other_costs_currency_id: integer().default(1),
});

export const localsT = pgTable("locals_t", {
  id: pk(),
  client_id: integer().notNull(),
  location: integer().notNull(),
  mca_lt_reference: varchar({ length: 100 }).notNull(),
  lot_num: varchar({ length: 100 }),
  horse: varchar({ length: 100 }),
  trailer_1: varchar({ length: 100 }),
  trailer_2: varchar({ length: 100 }),
  transporter: varchar({ length: 100 }),
  nbr_of_bags: integer(),
  weight: numeric({ precision: 10, scale: 2 }),
  arrival_date: date(),
  loading_date: date(),
  bp_details_received_date: date(),
  pv_div_mines_date: date(),
  demande_attestation_date: date(),
  ceec_in: date(),
  ceec_out: date(),
  cgea: varchar({ length: 100 }),
  gov_docs_complete_date: date(),
  disp_date: date(),
  end_of_formalities: date(),
  remarks: text(),
  display: varchar({ length: 1 }).notNull().default("Y"),
  created_by: integer().notNull().default(1),
  updated_by: integer().notNull().default(1),
  created_at: timestamp({ withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: false }).notNull().defaultNow(),
});
