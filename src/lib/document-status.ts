/**
 * Document workflow — DRAFT -> VERIFIED -> SUBMITTED.
 *
 * SUBMITTED is the final state: a submitted document is locked, and its body,
 * signatory block, remarks and attachment can no longer be changed. Only a
 * Super Admin (`role_id === 1`, the escape hatch used across auth/RBAC/menu)
 * can move it back out of SUBMITTED.
 *
 * This module is the one source of truth for the rules — both the API route
 * handlers and the UI import from here, so the lock cannot drift between them.
 */

export const DOC_STATUSES = ["DRAFT", "VERIFIED", "SUBMITTED"] as const;

export type DocStatus = (typeof DOC_STATUSES)[number];

/** The locked, final state. */
export const FINAL_STATUS: DocStatus = "SUBMITTED";

const LABELS: Record<DocStatus, string> = {
  DRAFT: "Draft",
  VERIFIED: "Verified",
  SUBMITTED: "Submitted",
};

/** What the button that advances out of this state should say. */
const NEXT_ACTION: Record<DocStatus, string> = {
  DRAFT: "Mark verified",
  VERIFIED: "Mark submitted",
  SUBMITTED: "",
};

/**
 * Is this exactly one of the known statuses? Unlike toDocStatus this does not
 * coerce — a request asking for an unknown status must be refused, not quietly
 * treated as DRAFT, which would downgrade the document.
 */
export function isDocStatus(value: unknown): value is DocStatus {
  return (DOC_STATUSES as readonly string[]).includes(String(value ?? "").toUpperCase());
}

/** Narrow an untrusted value (DB column, request body) to a known status. */
export function toDocStatus(value: unknown): DocStatus {
  const key = String(value ?? "").toUpperCase();
  return (DOC_STATUSES as readonly string[]).includes(key) ? (key as DocStatus) : "DRAFT";
}

export function statusLabel(value: unknown): string {
  return LABELS[toDocStatus(value)];
}

/** The status one step along, or null at the end of the flow. */
export function nextStatus(value: unknown): DocStatus | null {
  const i = DOC_STATUSES.indexOf(toDocStatus(value));
  return i >= 0 && i < DOC_STATUSES.length - 1 ? DOC_STATUSES[i + 1] : null;
}

/** The status one step back, or null at the start of the flow. */
export function prevStatus(value: unknown): DocStatus | null {
  const i = DOC_STATUSES.indexOf(toDocStatus(value));
  return i > 0 ? DOC_STATUSES[i - 1] : null;
}

export function nextActionLabel(value: unknown): string {
  return NEXT_ACTION[toDocStatus(value)];
}

/** A submitted document is final — nothing about it may be edited. */
export function isLocked(value: unknown): boolean {
  return toDocStatus(value) === FINAL_STATUS;
}

/** Super Admin bypasses the lock, matching the role_id === 1 rule elsewhere. */
export function canEdit(value: unknown, roleId: number): boolean {
  return !isLocked(value) || roleId === 1;
}

/**
 * Is this status change allowed for this role?
 *
 * Forward one step is always allowed. Stepping back is allowed while the
 * document is still unlocked; reversing out of SUBMITTED needs Super Admin.
 */
export function canTransition(from: unknown, to: unknown, roleId: number): boolean {
  // The requested target must be explicit. The current value may still be
  // coerced: a null or legacy column value legitimately reads as DRAFT.
  if (!isDocStatus(to)) return false;
  const a = toDocStatus(from);
  const b = toDocStatus(to);
  if (a === b) return false;
  if (isLocked(a)) return roleId === 1;
  return nextStatus(a) === b || prevStatus(a) === b;
}

/** Why a transition was refused — used for the API error message. */
export function transitionError(from: unknown, to: unknown, roleId: number): string | null {
  if (canTransition(from, to, roleId)) return null;
  if (!isDocStatus(to)) return `"${String(to)}" is not a valid status.`;
  if (isLocked(from)) {
    return "This document is submitted and locked. Only a Super Admin can reopen it.";
  }
  return `Cannot move a document from ${statusLabel(from)} to ${statusLabel(to)}.`;
}
