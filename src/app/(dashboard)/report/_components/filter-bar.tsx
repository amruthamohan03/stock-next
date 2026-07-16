"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import PrintButton from "./print-button";

export type FilterOption = { value: string; label: string; parent?: string };
export type FilterField = {
  key: string;
  label: string;
  type: "date" | "select" | "number" | "toggle";
  options?: FilterOption[];
  placeholder?: string;
  /** For cascading selects: only show options whose `parent` matches the
   *  current value of the field named here (e.g. dept depends on institution). */
  dependsOn?: string;
  colSpan?: 1 | 2;
};

/**
 * Generic filter bar for report pages. Reads the current values from the URL,
 * lets the user edit them, and on "Search" pushes them back as query params so
 * the (server) page re-queries. Keeps any params it doesn't own (e.g. `tab`).
 */
export default function FilterBar({
  fields,
  keep = [],
}: {
  fields: FilterField[];
  /** Extra query-param keys to preserve when applying (e.g. "tab"). */
  keep?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of fields) o[f.key] = params.get(f.key) ?? "";
    return o;
  });

  const set = (key: string, value: string) =>
    setVals((s) => {
      const next = { ...s, [key]: value };
      // Reset any field that cascades from this one.
      for (const f of fields) if (f.dependsOn === key) next[f.key] = "";
      return next;
    });

  const apply = () => {
    const sp = new URLSearchParams();
    for (const k of keep) {
      const v = params.get(k);
      if (v) sp.set(k, v);
    }
    for (const f of fields) {
      const v = vals[f.key]?.trim();
      if (v) sp.set(f.key, v);
    }
    router.push(`${pathname}?${sp.toString()}`);
  };

  const optionsFor = useMemo(
    () => (f: FilterField) => {
      if (!f.options) return [];
      if (!f.dependsOn) return f.options;
      const parent = vals[f.dependsOn];
      if (!parent) return f.options.filter((o) => !o.parent || o.parent === "0");
      return f.options.filter((o) => !o.parent || o.parent === parent || o.parent === "0");
    },
    [vals]
  );

  return (
    <div className="no-print flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {fields.map((f) => {
          if (f.type === "toggle") {
            const on = vals[f.key] === "1";
            return (
              <div key={f.key} className={`flex items-end ${f.colSpan === 2 ? "col-span-2" : ""}`}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => set(f.key, on ? "" : "1")}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    on
                      ? "border-accent bg-accent-soft text-accent-fg"
                      : "border-line bg-elevated text-muted hover:text-fg"
                  }`}
                >
                  <span className="font-medium">{f.label}</span>
                  <span
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                      on ? "bg-accent" : "bg-line"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        on ? "left-4" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
              </div>
            );
          }
          return (
            <div key={f.key} className={f.colSpan === 2 ? "col-span-2" : ""}>
              <Label className="text-xs">{f.label}</Label>
              {f.type === "select" ? (
                <SearchableSelect
                  value={vals[f.key]}
                  onChange={(v) => set(f.key, v)}
                  options={optionsFor(f)}
                  placeholder={f.placeholder ?? "All"}
                />
              ) : (
                <Input
                  type={f.type}
                  value={vals[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <PrintButton />
        <Button size="sm" onClick={apply}>
          <Search className="h-4 w-4" /> Search
        </Button>
      </div>
    </div>
  );
}
