import { Card, CardContent } from "@/components/ui/card";

export type Stat = {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "primary";
};

const toneClass: Record<NonNullable<Stat["tone"]>, string> = {
  default: "text-slate-800",
  success: "text-emerald-600",
  warning: "text-amber-600",
  primary: "text-blue-600",
};

/** Row of summary stat cards shown above a list (e.g. Stock Books, Live Stock). */
export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="py-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              {s.label}
            </p>
            <p className={`text-2xl font-semibold ${toneClass[s.tone ?? "default"]}`}>
              {s.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
