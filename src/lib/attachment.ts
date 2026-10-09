/**
 * Attachment vocabulary — shared by the upload route and the UI panel so the
 * categories, labels and tints cannot drift apart.
 *
 * One table and one route serve both committees and events; `owner_type`
 * says which, and `category` says what kind of paperwork it is.
 */

export const OWNER_TYPES = ["COMMITTEE", "EVENT"] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export function isOwnerType(value: unknown): value is OwnerType {
  return (OWNER_TYPES as readonly string[]).includes(String(value ?? "").toUpperCase());
}

export const CATEGORIES = [
  "ORDER",
  "MINUTES",
  "PHOTO",
  "INTERPOLY",
  "REPORT",
  "OTHER",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  ORDER: "Appointment Order",
  MINUTES: "Meeting Minutes",
  PHOTO: "Photos",
  INTERPOLY: "Inter-Poly Documents",
  REPORT: "Reports",
  OTHER: "Other Files",
};

/** Opacity-form tints so a chip reads on both themes (CLAUDE.md, Theming). */
export const CATEGORY_TINT: Record<Category, string> = {
  ORDER: "bg-violet-500/15 text-violet-500 ring-violet-500/25",
  MINUTES: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  PHOTO: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  INTERPOLY: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  REPORT: "bg-rose-500/15 text-rose-500 ring-rose-500/25",
  OTHER: "bg-slate-500/15 text-slate-500 ring-slate-500/25",
};

export function isCategory(value: unknown): value is Category {
  return (CATEGORIES as readonly string[]).includes(String(value ?? "").toUpperCase());
}

export function toCategory(value: unknown): Category {
  const key = String(value ?? "").toUpperCase();
  return isCategory(key) ? (key as Category) : "OTHER";
}

export function categoryLabel(value: unknown): string {
  return CATEGORY_LABEL[toCategory(value)];
}

/** Which categories make sense for each owner, in the order they are shown. */
export const CATEGORIES_FOR: Record<OwnerType, Category[]> = {
  COMMITTEE: ["ORDER", "MINUTES", "REPORT", "OTHER"],
  EVENT: ["PHOTO", "INTERPOLY", "REPORT", "MINUTES", "OTHER"],
};

export const categoryOptions = (owner: OwnerType) =>
  CATEGORIES_FOR[owner].map((c) => ({ value: c, label: CATEGORY_LABEL[c] }));

/** "1.4 MB" — a size a person can read. */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export const isImageType = (type: string | null | undefined) =>
  (type ?? "").startsWith("image/");
