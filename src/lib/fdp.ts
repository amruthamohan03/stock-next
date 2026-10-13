/**
 * FDP vocabulary — the one source of truth for delivery modes and the
 * derived helpers, shared by the list, the form and the cards.
 */

export const FDP_MODES = ["ONLINE", "OFFLINE", "HYBRID"] as const;
export type FdpMode = (typeof FDP_MODES)[number];

export const FDP_MODE_LABEL: Record<FdpMode, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  HYBRID: "Hybrid",
};

/** Opacity-form tints so a badge reads on both themes (CLAUDE.md, Theming). */
export const FDP_MODE_TINT: Record<FdpMode, string> = {
  ONLINE: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  OFFLINE: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  HYBRID: "bg-violet-500/15 text-violet-500 ring-violet-500/25",
};

export const FDP_MODE_GRAD: Record<FdpMode, string> = {
  ONLINE: "grad-blue",
  OFFLINE: "grad-amber",
  HYBRID: "grad-violet",
};

export function isFdpMode(value: unknown): value is FdpMode {
  return (FDP_MODES as readonly string[]).includes(String(value ?? "").toUpperCase());
}

export function toFdpMode(value: unknown): FdpMode {
  const key = String(value ?? "").toUpperCase();
  return isFdpMode(key) ? (key as FdpMode) : "ONLINE";
}

export function fdpModeLabel(value: unknown): string {
  return FDP_MODE_LABEL[toFdpMode(value)];
}

export const FDP_MODE_OPTIONS = FDP_MODES.map((m) => ({
  value: m,
  label: FDP_MODE_LABEL[m],
}));

/**
 * Inclusive day count across the programme — 23rd to 25th is three days, not
 * two. Derived rather than stored so it can never drift from the dates.
 */
export function durationDays(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): number | null {
  if (!start) return null;
  const a = new Date(start);
  const b = end ? new Date(end) : a;
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const DAY = 24 * 60 * 60 * 1000;
  // Compare calendar days, so a timezone offset cannot shift the count.
  const days =
    Math.round(
      (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
        Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
        DAY
    ) + 1;
  return days > 0 ? days : null;
}

/** "3 days" / "1 day" — for the card and the hero. */
export function durationLabel(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  const n = durationDays(start, end);
  return n === null ? "" : `${n} day${n === 1 ? "" : "s"}`;
}

/**
 * Split the topics field into separate entries.
 *
 * Lines win when there are any: a topic routinely contains a comma of its own
 * ("Web skills, Digital communication & professional documentation" is one
 * bullet on the brochure, not two). Commas and semicolons are only separators
 * when everything was typed on a single line.
 */
export function topicList(topics: string | null | undefined): string[] {
  const text = (topics ?? "").trim();
  if (!text) return [];
  const byLine = text
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (byLine.length > 1) return byLine;
  return text
    .split(/[,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}
