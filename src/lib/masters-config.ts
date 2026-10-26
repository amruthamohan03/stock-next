import type { PgTable } from "drizzle-orm/pg-core";
import {
  makeT,
  modelT,
  staffT,
  designationMasterT,
  qualificationMasterT,
  subjectMasterT,
  departmentMasterT,
  serviceProvidersT,
  daybookUnitT,
  itemMasterT,
  groupItemNameMasterT,
  menuMasterT,
  roleMasterT,
  usersT,
  dashboardCardMasterT,
  committeeT,
  studyMaterialT,
  fdpT,
  indentBookT,
  stockBookMasterT,
  issuedToMasterT,
} from "@/db/schema";

export type MasterConfig = {
  table: PgTable;
  /** Columns a client is allowed to write (whitelist). */
  writable: string[];
  /** Columns that should be coerced to integers. */
  numeric?: string[];
  /** Numeric columns where a blank value means "not set" and must be stored as
   *  NULL rather than 0 — foreign keys, page counts and the like. Flag columns
   *  (0/1) are left out, since 0 is a real value for them. */
  nullWhenBlank?: string[];
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
  // Where items live and where they are issued to — labs, stores, offices.
  // The table keeps its original name (issued_to_master_t): stock transactions
  // already point at it through issued_to_location_id and
  // transferred_from_location_id, so the rows must keep their ids.
  location: {
    table: issuedToMasterT,
    writable: [
      "location_code",
      "location_name",
      "description",
      "contact_person",
      "phone",
      "display",
    ],
    requiredOnInsert: ["location_code", "location_name"],
    unique: ["location_code"],
  },
  // The physical indent books. An indent's book_no is one of these ids, so a
  // book must keep its id once indents point at it — soft delete, never hard.
  "indent-book": {
    table: indentBookT,
    writable: [
      "book_name",
      "book_no",
      "volume",
      "department_id",
      "item_type_ids",
      "academic_year",
      "total_pages",
      "description",
      "display",
    ],
    numeric: ["book_no", "volume", "department_id", "total_pages"],
    nullWhenBlank: ["book_no", "volume", "department_id", "total_pages"],
    requiredOnInsert: ["book_name"],
  },
  // The physical stock registers — the bound books, not the balance ledger in
  // stock_book_t.
  "stock-book": {
    table: stockBookMasterT,
    writable: [
      "book_name",
      "book_no",
      "volume",
      "stockbook_type_id",
      "department_id",
      "item_type_ids",
      "academic_year",
      "total_pages",
      "description",
      "display",
    ],
    numeric: ["book_no", "volume", "stockbook_type_id", "department_id", "total_pages"],
    nullWhenBlank: ["book_no", "volume", "stockbook_type_id", "department_id", "total_pages"],
    requiredOnInsert: ["book_name"],
  },
  // Faculty Development Programmes attended by staff. Certificates and
  // schedules are attached separately via /api/attachment (owner_type FDP).
  fdp: {
    table: fdpT,
    writable: [
      "title",
      "staff_id",
      "faculty_name",
      "organizer",
      "collaborator",
      "mode",
      "venue",
      "start_date",
      "end_date",
      "academic_year",
      "subject_id",
      "department_id",
      "topics",
      "remarks",
      "display",
    ],
    numeric: ["staff_id", "subject_id", "department_id"],
  },
  // Study materials — lab manuals, notes, question papers. Files are attached
  // separately through /api/attachment (owner_type MATERIAL).
  "study-material": {
    table: studyMaterialT,
    writable: [
      "title",
      "material_type",
      "subject_id",
      "department_id",
      "semester",
      "scheme",
      "academic_year",
      "exam_session",
      "module_no",
      "description",
      "uploaded_by",
      "display",
    ],
    numeric: ["subject_id", "department_id", "uploaded_by"],
  },
  // Institution committees — the parent record an event hangs off.
  committee: {
    table: committeeT,
    writable: [
      "name",
      "committee_type",
      "academic_year",
      "description",
      "order_no",
      "order_date",
      "display",
    ],
  },
  make: {
    table: makeT,
    writable: ["make_name", "display"],
  },
  model: {
    table: modelT,
    writable: ["make_id", "model_name", "display"],
    numeric: ["make_id"],
  },
  staff: {
    table: staffT,
    writable: [
      "staff_code",
      "staff_name",
      "designation",
      "department_id",
      "posting_type",
      "qualification",
      "subjects",
      "max_periods_per_week",
      "email",
      "phone",
      "gender",
      "date_of_joining",
      "display",
    ],
    numeric: ["department_id", "max_periods_per_week"],
    requiredOnInsert: ["staff_name"],
    // Blank codes are auto-generated by a DB trigger (STFxxxx); a typed code
    // must still be unique.
    unique: ["staff_code"],
  },
  designation: {
    table: designationMasterT,
    writable: ["designation_name", "staff_type", "staff_category", "display"],
    requiredOnInsert: ["designation_name"],
    unique: ["designation_name"],
  },
  qualification: {
    table: qualificationMasterT,
    writable: ["qualification_name", "display"],
    requiredOnInsert: ["qualification_name"],
    unique: ["qualification_name"],
  },
  subject: {
    table: subjectMasterT,
    writable: [
      "subject_code",
      "subject_name",
      "department_id",
      "semester",
      "scheme",
      "course_category",
      "subject_type",
      "lecture_hours",
      "tutorial_hours",
      "practical_hours",
      "credits", // numeric — passed as string, so NOT in `numeric` below
      "display",
    ],
    numeric: ["department_id", "lecture_hours", "tutorial_hours", "practical_hours"],
    requiredOnInsert: ["subject_name"],
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
