/**
 * Helpers for the comma-separated value lists used by every multi-select in
 * the app — the chip rows in CrudTable, the multi dropdowns on report filters,
 * and the `?dept_id=1,2` style query params they produce.
 *
 * One string column (or one query param) holds the whole selection, so there
 * is no child table or repeated param to keep in step.
 */

/** Split a stored "1,3" value into its parts, ignoring blanks and spacing. */
export function csvParts(csv: string | null | undefined): string[] {
  return String(csv ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Add or remove one value from a comma-separated list, keeping the order of
 * `order` so the stored string does not depend on the order of clicks.
 */
export function toggleCsv(csv: string, value: string, order: string[]): string {
  const cur = csvParts(csv);
  const next = cur.includes(value) ? cur.filter((c) => c !== value) : [...cur, value];
  return order.filter((o) => next.includes(o)).join(",");
}
