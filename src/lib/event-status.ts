/**
 * Event workflow and scoring rules — the one source of truth shared by the API
 * route handlers and the UI, so the lock and the maths cannot drift apart.
 *
 * An event is OPEN while scores are being collected. Finalising it computes
 * each item's placings from the averages, then locks: items, duties,
 * participants and scores all become read-only. Only a Super Admin
 * (`role_id === 1`, the escape hatch used across auth/RBAC/menu) can reopen it.
 */

export const EVENT_STATUSES = ["OPEN", "FINALISED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

const LABELS: Record<EventStatus, string> = {
  OPEN: "Open",
  FINALISED: "Finalised",
};

/** Exact match, no coercion — an unknown target must be refused, not guessed. */
export function isEventStatus(value: unknown): value is EventStatus {
  return (EVENT_STATUSES as readonly string[]).includes(String(value ?? "").toUpperCase());
}

/** Narrow a DB column (which may be null on legacy rows) to a known status. */
export function toEventStatus(value: unknown): EventStatus {
  const key = String(value ?? "").toUpperCase();
  return (EVENT_STATUSES as readonly string[]).includes(key) ? (key as EventStatus) : "OPEN";
}

export function eventStatusLabel(value: unknown): string {
  return LABELS[toEventStatus(value)];
}

/** A finalised event is read-only: results have been published. */
export function isEventLocked(value: unknown): boolean {
  return toEventStatus(value) === "FINALISED";
}

/** Super Admin bypasses the lock, matching the rule used elsewhere. */
export function canEditEvent(value: unknown, roleId: number): boolean {
  return !isEventLocked(value) || roleId === 1;
}

export function eventTransitionError(status: unknown, roleId: number): string | null {
  if (canEditEvent(status, roleId)) return null;
  return "This event is finalised and locked. Only a Super Admin can reopen it.";
}

/* ------------------------------------------------------------------ scoring */

/** Parse a score cell that may be "", null, or a numeric string. */
export function toScore(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Average of the judges who actually scored — not a fixed divisor of three.
 * Items are judged by one, two or three judges depending on the duty list
 * (Ganamela had a single judge; Nadanpattu had three), and dividing by three
 * regardless would quietly halve a one-judge item's score.
 */
export function averageOf(scores: (number | null)[]): number | null {
  const given = scores.filter((s): s is number => s !== null);
  if (given.length === 0) return null;
  const mean = given.reduce((a, b) => a + b, 0) / given.length;
  return Number(mean.toFixed(2));
}

/** Grade bands used on the printed score card. */
export function gradeFor(average: number | null): string | null {
  if (average === null) return null;
  if (average >= 80) return "A";
  if (average >= 60) return "B";
  if (average >= 40) return "C";
  return null;
}

export type Placeable = { id: number; average_score: unknown };

/**
 * Rank an item's participants into 1st/2nd/3rd by average, descending.
 *
 * Ties share a place and consume the slots below them (80, 80, 70 → 1, 1, 3),
 * which is how a tie is handled on the sheet. Anyone unscored, or below the
 * top three places, is left unplaced.
 */
export function computePlaces(rows: Placeable[]): Map<number, number | null> {
  const scored = rows
    .map((r) => ({ id: r.id, avg: toScore(r.average_score) }))
    .filter((r): r is { id: number; avg: number } => r.avg !== null)
    .sort((a, b) => b.avg - a.avg);

  const places = new Map<number, number | null>();
  for (const r of rows) places.set(r.id, null);

  let place = 0;
  let lastAvg: number | null = null;
  scored.forEach((r, index) => {
    // A new (lower) score takes the next place by position, so ties share.
    if (lastAvg === null || r.avg < lastAvg) {
      place = index + 1;
      lastAvg = r.avg;
    }
    if (place <= 3) places.set(r.id, place);
  });

  return places;
}

/** "1st" / "2nd" / "3rd" — for the results table and the certificate. */
export function ordinal(place: number | null | undefined): string {
  if (!place) return "";
  const suffix = place === 1 ? "st" : place === 2 ? "nd" : place === 3 ? "rd" : "th";
  return `${place}${suffix}`;
}

export const ITEM_CATEGORIES = ["ON_STAGE", "OFF_STAGE"] as const;
export const CATEGORY_LABEL: Record<string, string> = {
  ON_STAGE: "On Stage",
  OFF_STAGE: "Off Stage",
};

export const DUTY_ROLES = ["COORDINATOR", "JUDGE"] as const;
export const DUTY_ROLE_LABEL: Record<string, string> = {
  COORDINATOR: "Coordinator",
  JUDGE: "Judge",
};
