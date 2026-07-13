import { Card } from "@/components/ui/card";

export type Stat = {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "primary";
};

const TONES: Record<NonNullable<Stat["tone"]>, { text: string; bar: string }> = {
  default: { text: "text-slate-800", bar: "bg-slate-300" },
  success: { text: "text-emerald-600", bar: "bg-emerald-500" },
  warning: { text: "text-amber-600", bar: "bg-amber-500" },
  primary: { text: "text-brand-600", bar: "bg-brand-500" },
};

/** Row of summary stat cards shown above a list (e.g. Stock Books, Live Stock). */
export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => {
        const tone = TONES[s.tone ?? "default"];
        return (
          <Card key={s.label} className="flex items-stretch overflow-hidden">
            <span className={`w-1 shrink-0 ${tone.bar}`} aria-hidden />
            <div className="px-4 py-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                {s.label}
              </p>
              <p className={`text-2xl font-semibold ${tone.text}`}>{s.value}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
