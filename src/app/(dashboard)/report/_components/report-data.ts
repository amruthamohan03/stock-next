import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  collegeT,
  departmentMasterT,
  indentBookT,
  quotationCategoriesT,
  stockBookMasterT,
  stockbookTypeT,
} from "@/db/schema";
import type { FilterOption } from "./filter-bar";

export type SP = Record<string, string | string[] | undefined>;

/** Read a single search-param value as a string. */
export const one = (sp: SP, key: string): string => {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
};

/** Parse a positive integer param (0 when absent/invalid). */
export const intParam = (sp: SP, key: string): number => {
  const n = Number(one(sp, key));
  return Number.isInteger(n) && n > 0 ? n : 0;
};

/**
 * Parse a multi-select param ("1,2") into positive integers, de-duplicated.
 * Anything that is not a positive integer is dropped, so a hand-edited URL
 * cannot push junk into a query.
 */
export const intListParam = (sp: SP, key: string): number[] => {
  const seen = new Set<number>();
  for (const part of one(sp, key).split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0) seen.add(n);
  }
  return [...seen];
};

/**
 * Parse a multi-select param of code values ("WORKING,DAMAGED"), keeping only
 * the ones in `allowed` — the same reason as above.
 */
export const codeListParam = (sp: SP, key: string, allowed: readonly string[]): string[] => {
  const ok = new Set(allowed);
  const seen = new Set<string>();
  for (const part of one(sp, key).split(",")) {
    const v = part.trim().toUpperCase();
    if (ok.has(v)) seen.add(v);
  }
  return [...seen];
};

/**
 * Read a param that must be one of a known set — sort keys and directions.
 * Anything else falls back, so a hand-edited URL can never reach the SQL.
 */
export const pickParam = <T extends string>(
  sp: SP,
  key: string,
  allowed: readonly T[],
  fallback: T
): T => {
  const v = one(sp, key);
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

/** The two sort directions, as a filter-bar option list. */
export const DIRECTIONS = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
] as const;

/** Return an ISO date param only if it is a valid YYYY-MM-DD string. */
export const dateParam = (sp: SP, key: string): string | null => {
  const v = one(sp, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};

/** A human-friendly "01 Jan 2025 to 31 Mar 2025" label for the report header. */
export function periodLabel(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  const fmt = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  return `${fmt(from)} to ${fmt(to)}`;
}

/** Kerala polytechnic academic year (June–May cycle) from a date. */
export function academicYear(from: string | null): string | null {
  if (!from) return null;
  const d = new Date(from + "T00:00:00");
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return m >= 6
    ? `${y}-${String(y + 1).slice(-2)}`
    : `${y - 1}-${String(y).slice(-2)}`;
}

/** Dropdown options shared by every report filter bar. */
export async function getReportOptions(): Promise<{
  institutions: FilterOption[];
  departments: FilterOption[];
  stockbookTypes: FilterOption[];
  indentBooks: FilterOption[];
  stockBooks: FilterOption[];
  itemCategories: FilterOption[];
}> {
  const [colleges, depts, types, indentBooks, stockBooks, categories] = await Promise.all([
    db
      .select({ id: collegeT.id, name: collegeT.college_name })
      .from(collegeT)
      .where(eq(collegeT.display, "Y"))
      .orderBy(asc(collegeT.college_name)),
    db
      .select({
        id: departmentMasterT.id,
        name: departmentMasterT.department_name,
        college_id: departmentMasterT.college_id,
      })
      .from(departmentMasterT)
      .where(eq(departmentMasterT.display, "Y"))
      .orderBy(asc(departmentMasterT.department_name)),
    db
      .select({ id: stockbookTypeT.id, name: stockbookTypeT.name })
      .from(stockbookTypeT)
      .where(eq(stockbookTypeT.display, "Y"))
      .orderBy(asc(stockbookTypeT.name)),
    db
      .select({ id: indentBookT.id, name: indentBookT.book_name, book_no: indentBookT.book_no })
      .from(indentBookT)
      .where(eq(indentBookT.display, "Y"))
      .orderBy(asc(indentBookT.book_name)),
    db
      .select({
        id: stockBookMasterT.id,
        name: stockBookMasterT.book_name,
        book_no: stockBookMasterT.book_no,
      })
      .from(stockBookMasterT)
      .where(eq(stockBookMasterT.display, "Y"))
      .orderBy(asc(stockBookMasterT.book_name)),
    db
      .select({ id: quotationCategoriesT.id, name: quotationCategoriesT.category_name })
      .from(quotationCategoriesT)
      .where(eq(quotationCategoriesT.display, "Y"))
      .orderBy(asc(quotationCategoriesT.category_name)),
  ]);

  return {
    institutions: colleges.map((c) => ({ value: String(c.id), label: c.name })),
    departments: depts.map((d) => ({
      value: String(d.id),
      label: d.name,
      parent: String(d.college_id ?? 0),
    })),
    stockbookTypes: types.map((t) => ({ value: String(t.id), label: t.name })),
    indentBooks: indentBooks.map((b) => ({
      value: String(b.id),
      label: b.book_no ? `${b.name} (Book ${b.book_no})` : b.name,
    })),
    stockBooks: stockBooks.map((b) => ({
      value: String(b.id),
      label: b.book_no ? `${b.name} (Book ${b.book_no})` : b.name,
    })),
    itemCategories: categories.map((c) => ({ value: String(c.id), label: c.name })),
  };
}

/** Resolve institution / department names for the printed report header. */
export async function resolveInstDept(
  sp: SP
): Promise<{ institution: string | null; department: string | null }> {
  const instId = intParam(sp, "institution_id");
  const deptId = intParam(sp, "dept_id");

  const [inst, dept] = await Promise.all([
    instId
      ? db
          .select({ name: collegeT.college_name })
          .from(collegeT)
          .where(eq(collegeT.id, instId))
          .limit(1)
      : Promise.resolve([] as { name: string }[]),
    deptId
      ? db
          .select({ name: departmentMasterT.department_name })
          .from(departmentMasterT)
          .where(eq(departmentMasterT.id, deptId))
          .limit(1)
      : Promise.resolve([] as { name: string }[]),
  ]);

  return {
    institution: inst[0]?.name ?? null,
    department: dept[0]?.name ?? null,
  };
}
