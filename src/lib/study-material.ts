/**
 * Study material vocabulary — the one source of truth for material types,
 * shared by the list, the form and the cards so labels and tints cannot drift.
 */

export const MATERIAL_TYPES = [
  "LAB_MANUAL",
  "NOTES",
  "QUESTION_PAPER",
  "SYLLABUS",
  "ASSIGNMENT",
  "REFERENCE",
  "OTHER",
] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const MATERIAL_TYPE_LABEL: Record<MaterialType, string> = {
  LAB_MANUAL: "Lab Manual",
  NOTES: "Notes",
  QUESTION_PAPER: "Previous Question Paper",
  SYLLABUS: "Syllabus",
  ASSIGNMENT: "Assignment",
  REFERENCE: "Reference",
  OTHER: "Other",
};

/** Shorter label for the card header, where space is tight. */
export const MATERIAL_TYPE_SHORT: Record<MaterialType, string> = {
  LAB_MANUAL: "Lab Manual",
  NOTES: "Notes",
  QUESTION_PAPER: "Question Paper",
  SYLLABUS: "Syllabus",
  ASSIGNMENT: "Assignment",
  REFERENCE: "Reference",
  OTHER: "Other",
};

/** Opacity-form tints so a badge reads on both themes (CLAUDE.md, Theming). */
export const MATERIAL_TYPE_TINT: Record<MaterialType, string> = {
  LAB_MANUAL: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  NOTES: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  QUESTION_PAPER: "bg-violet-500/15 text-violet-500 ring-violet-500/25",
  SYLLABUS: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  ASSIGNMENT: "bg-rose-500/15 text-rose-500 ring-rose-500/25",
  REFERENCE: "bg-cyan-500/15 text-cyan-500 ring-cyan-500/25",
  OTHER: "bg-slate-500/15 text-slate-500 ring-slate-500/25",
};

/** Gradient for the card's header strip, one per type. */
export const MATERIAL_TYPE_GRAD: Record<MaterialType, string> = {
  LAB_MANUAL: "grad-amber",
  NOTES: "grad-blue",
  QUESTION_PAPER: "grad-violet",
  SYLLABUS: "grad-green",
  ASSIGNMENT: "grad-rose",
  REFERENCE: "grad-cyan",
  OTHER: "grad-cyan",
};

export function isMaterialType(value: unknown): value is MaterialType {
  return (MATERIAL_TYPES as readonly string[]).includes(String(value ?? "").toUpperCase());
}

export function toMaterialType(value: unknown): MaterialType {
  const key = String(value ?? "").toUpperCase();
  return isMaterialType(key) ? (key as MaterialType) : "OTHER";
}

export function materialTypeLabel(value: unknown): string {
  return MATERIAL_TYPE_LABEL[toMaterialType(value)];
}

export const MATERIAL_TYPE_OPTIONS = MATERIAL_TYPES.map((t) => ({
  value: t,
  label: MATERIAL_TYPE_LABEL[t],
}));

/**
 * Which extra field matters for a given type — shown on the form and the card.
 * A question paper is identified by its exam session, a set of notes by its
 * module; asking for both on every type would be noise.
 */
export function detailFieldFor(type: unknown): "exam_session" | "module_no" | null {
  const t = toMaterialType(type);
  if (t === "QUESTION_PAPER") return "exam_session";
  if (t === "NOTES" || t === "ASSIGNMENT") return "module_no";
  return null;
}

/** Semesters offered, for the dropdowns. */
export const SEMESTERS = ["S1", "S2", "S3", "S4", "S5", "S6"] as const;
export const SEMESTER_OPTIONS = SEMESTERS.map((s) => ({ value: s, label: s }));
