import type { PgTable } from "drizzle-orm/pg-core";
import {
  makeT,
  modelT,
  departmentMasterT,
  serviceProvidersT,
  daybookUnitT,
  itemMasterT,
  groupItemNameMasterT,
} from "@/db/schema";

export type MasterConfig = {
  table: PgTable;
  /** Columns a client is allowed to write (whitelist). */
  writable: string[];
  /** Columns that should be coerced to integers. */
  numeric?: string[];
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
};
