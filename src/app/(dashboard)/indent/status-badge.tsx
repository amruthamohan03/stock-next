// Shared status pill for indents — one source of truth for the workflow colours,
// used by both the list table and the detail view.
const STATUS_STYLES: Record<string, string> = {
  CREATED: "bg-slate-100 text-slate-600 ring-slate-200",
  VERIFIED: "bg-sky-50 text-sky-700 ring-sky-200",
  PASSED: "bg-violet-50 text-violet-700 ring-violet-200",
  ISSUED: "bg-amber-50 text-amber-700 ring-amber-200",
  RECEIVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = status ?? "CREATED";
  const style = STATUS_STYLES[key] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {key}
    </span>
  );
}
