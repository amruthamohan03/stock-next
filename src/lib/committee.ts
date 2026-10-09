/**
 * Committee vocabulary — the one source of truth for member roles, shared by
 * the API routes and the UI so the labels and ordering cannot drift.
 */

/** Ordered by seniority: this is also the order members are listed in. */
export const MEMBER_ROLES = [
  "CHAIRMAN",
  "CONVENOR",
  "ADVISER",
  "SECRETARY",
  "MEMBER",
  "STUDENT",
] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  CHAIRMAN: "Chairman",
  CONVENOR: "Convenor",
  ADVISER: "Adviser",
  SECRETARY: "Secretary",
  MEMBER: "Member",
  STUDENT: "Student Representative",
};

/**
 * Tints use the opacity form so a badge reads on both themes — the `-50/-700`
 * light shades would wash out in dark mode (see CLAUDE.md, Theming).
 */
export const MEMBER_ROLE_TINT: Record<MemberRole, string> = {
  CHAIRMAN: "bg-violet-500/15 text-violet-500 ring-violet-500/25",
  CONVENOR: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  ADVISER: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  SECRETARY: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  MEMBER: "bg-slate-500/15 text-slate-500 ring-slate-500/25",
  STUDENT: "bg-rose-500/15 text-rose-500 ring-rose-500/25",
};

export function isMemberRole(value: unknown): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(String(value ?? "").toUpperCase());
}

export function toMemberRole(value: unknown): MemberRole {
  const key = String(value ?? "").toUpperCase();
  return isMemberRole(key) ? (key as MemberRole) : "MEMBER";
}

export function memberRoleLabel(value: unknown): string {
  return MEMBER_ROLE_LABEL[toMemberRole(value)];
}

/** Rank for sorting — seniority first, then the row's own sort_order. */
export function memberRoleRank(value: unknown): number {
  return MEMBER_ROLES.indexOf(toMemberRole(value));
}

export const MEMBER_ROLE_OPTIONS = MEMBER_ROLES.map((r) => ({
  value: r,
  label: MEMBER_ROLE_LABEL[r],
}));

export const COMMITTEE_TYPES = ["ARTS", "SPORTS", "ACADEMIC", "ANTI_RAGGING", "OTHER"] as const;

export const COMMITTEE_TYPE_LABEL: Record<string, string> = {
  ARTS: "Arts",
  SPORTS: "Sports",
  ACADEMIC: "Academic",
  ANTI_RAGGING: "Anti-Ragging",
  OTHER: "Other",
};

export const COMMITTEE_TYPE_OPTIONS = COMMITTEE_TYPES.map((t) => ({
  value: t,
  label: COMMITTEE_TYPE_LABEL[t],
}));

/** Initials for the member avatar — "Amrutha Mohan" -> "AM". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Gradient helper per committee type — used for the card header strip. */
export const COMMITTEE_TYPE_GRAD: Record<string, string> = {
  ARTS: "grad-violet",
  SPORTS: "grad-green",
  ACADEMIC: "grad-blue",
  ANTI_RAGGING: "grad-rose",
  OTHER: "grad-cyan",
};
