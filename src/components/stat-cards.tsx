export type Stat = {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "primary";
};

// Vibrant gradient tiles (Modernize/NextUI style) — bright fills, white text.
const TONES: Record<NonNullable<Stat["tone"]>, string> = {
  default: "grad-blue",
  primary: "grad-violet",
  success: "grad-green",
  warning: "grad-amber",
};

/** Row of summary stat cards shown above a list (e.g. Stock Books, Live Stock). */
export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`relative overflow-hidden rounded-xl p-4 text-white shadow-card ${
            TONES[s.tone ?? "default"]
          }`}
        >
          {/* subtle sheen */}
          <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/15 blur-xl" />
          <p className="relative mb-1 text-xs font-medium uppercase tracking-wide text-white/80">
            {s.label}
          </p>
          <p className="relative text-2xl font-bold">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
