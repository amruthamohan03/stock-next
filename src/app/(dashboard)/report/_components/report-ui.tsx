import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** A vibrant stat tile for report summaries (uses the grad-* helpers). */
export function StatCard({
  label,
  value,
  grad = "grad-blue",
}: {
  label: string;
  value: React.ReactNode;
  grad?: string;
}) {
  return (
    <div className={`${grad} rounded-xl p-4 text-white shadow-sm print-avoid-break`}>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-white/85">
        {label}
      </div>
    </div>
  );
}

export type ReportTab = { key: string; label: string; icon?: LucideIcon };

/** Tab strip for report pages. Each tab is a link that sets `?tab=` while
 *  preserving the other active filters. */
export function ReportTabs({
  tabs,
  current,
  params,
  basePath,
}: {
  tabs: ReportTab[];
  current: string;
  params: Record<string, string>;
  basePath: string;
}) {
  const hrefFor = (key: string) => {
    const sp = new URLSearchParams(params);
    sp.set("tab", key);
    return `${basePath}?${sp.toString()}`;
  };

  return (
    <div className="no-print flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
      {tabs.map((t) => {
        const active = t.key === current;
        const Icon = t.icon;
        return (
          <Link
            key={t.key}
            href={hrefFor(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-accent text-accent-fg shadow-sm"
                : "text-muted hover:bg-elevated hover:text-fg"
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

/** The printable report header shown above each report's table(s). */
export function ReportHeader({
  title,
  institution,
  department,
  period,
  meta,
}: {
  title: string;
  institution?: string | null;
  department?: string | null;
  period?: string | null;
  meta?: string | null;
}) {
  return (
    <div className="mb-4 border-b border-line pb-3 text-center">
      <div className="text-lg font-bold text-fg">
        {institution || "Government Polytechnic College"}
      </div>
      {department && <div className="text-sm font-semibold text-muted">{department}</div>}
      <div className="mt-1 inline-block rounded-md border border-line bg-elevated px-4 py-1 text-sm font-bold uppercase tracking-widest text-fg">
        {title}
      </div>
      <div className="mt-1 text-xs text-faint">
        {period ? `Period: ${period}` : "All Dates"}
        {meta ? ` · ${meta}` : ""}
      </div>
    </div>
  );
}
