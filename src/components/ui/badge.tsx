/**
 * The one badge in the app.
 *
 * Both the master lists (Y/N, PERMANENT/GUEST, …) and the workflow pills
 * (DRAFT → VERIFIED → SUBMITTED) used to carry their own copy of this map and
 * class list; they both come through here now, so a tint only has to be picked
 * once.
 *
 * Tints use the opacity form (`bg-*-500/15` + `ring-*-500/25`) rather than the
 * `-50`/`-700` light shades, so a badge reads correctly on dark and light.
 */
const TONES: Record<string, string> = {
  // Yes / no and record status
  Y: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  N: "bg-slate-500/15 text-slate-400 ring-slate-500/25",
  C: "bg-brand-500/15 text-brand-400 ring-brand-500/25",
  // Indent workflow
  CREATED: "bg-slate-500/15 text-slate-500 ring-slate-500/25",
  PASSED: "bg-violet-500/15 text-violet-500 ring-violet-500/25",
  ISSUED: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  RECEIVED: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  // Document workflow (VERIFIED is shared with indents)
  DRAFT: "bg-slate-500/15 text-slate-500 ring-slate-500/25",
  VERIFIED: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  SUBMITTED: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  // Master list values
  PUBLIC: "bg-indigo-500/15 text-indigo-400 ring-indigo-500/25",
  PRIVATE: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  PERMANENT: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  GUEST: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  TEACHING: "bg-brand-500/15 text-brand-400 ring-brand-500/25",
  NON_TEACHING: "bg-slate-500/15 text-slate-400 ring-slate-500/25",
  FACULTY: "bg-brand-500/15 text-brand-400 ring-brand-500/25",
  LAB_STAFF: "bg-cyan-500/15 text-cyan-500 ring-cyan-500/25",
  OFFICE_STAFF: "bg-violet-500/15 text-violet-400 ring-violet-500/25",
  OTHER: "bg-slate-500/15 text-slate-400 ring-slate-500/25",
};

const FALLBACK = "bg-slate-500/15 text-muted ring-slate-500/25";

/** "LAB_STAFF" → "Lab Staff"; short codes like Y/N are left alone. */
export function badgeLabel(value: string): string {
  if (value.length <= 2) return value;
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Badge({
  value,
  label,
  dot = false,
}: {
  value: string | null | undefined;
  /** Display text, when it should differ from the raw value. */
  label?: string;
  /** Leading dot — used by the workflow pills. */
  dot?: boolean;
}) {
  const raw = String(value ?? "");
  const key = raw.toUpperCase();
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        TONES[key] ?? FALLBACK
      }`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {label ?? (badgeLabel(raw) || "—")}
    </span>
  );
}
