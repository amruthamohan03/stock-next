// Shared status pill — one source of truth for workflow colours across the app.
// Used by the indent list/detail and by the document workflow.
//
// Tints use the opacity form (`bg-*-500/15` + `ring-*-500/25`) rather than the
// `-50`/`-700` light shades, so a badge reads correctly in both themes.
const STATUS_STYLES: Record<string, string> = {
  // Indents
  CREATED: "bg-slate-500/15 text-slate-500 ring-slate-500/25",
  PASSED: "bg-violet-500/15 text-violet-500 ring-violet-500/25",
  ISSUED: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  RECEIVED: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  // Documents (VERIFIED is shared with indents)
  DRAFT: "bg-slate-500/15 text-slate-500 ring-slate-500/25",
  VERIFIED: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  SUBMITTED: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
};

const FALLBACK = "bg-slate-500/15 text-slate-500 ring-slate-500/25";

export function StatusBadge({
  status,
  label,
}: {
  status: string | null | undefined;
  /** Display text, when it should differ from the raw status key. */
  label?: string;
}) {
  const key = status ?? "CREATED";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_STYLES[key] ?? FALLBACK
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label ?? key}
    </span>
  );
}
