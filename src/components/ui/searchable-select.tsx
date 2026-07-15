"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string | number; label: string };

/**
 * Searchable dropdown (combobox). Use this for EVERY select in the app instead
 * of a native <select> — the option list is filterable, which matters for long
 * master lists (items, models, departments, …).
 *
 * Note: native `required` doesn't apply to a custom control, so forms that use
 * this must validate required selects themselves (see CrudTable.submit).
 */
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => String(o.value) === String(value));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-lg border border-line bg-elevated px-3 text-sm shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60",
          selected ? "text-fg" : "text-faint"
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-faint" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-line px-2">
            <Search className="h-4 w-4 shrink-0 text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="h-8 w-full bg-transparent text-sm text-fg outline-none placeholder:text-faint"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-faint">No matches</li>
            )}
            {filtered.map((o) => {
              const active = String(o.value) === String(value);
              return (
                <li key={String(o.value)}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(String(o.value));
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-fg hover:bg-elevated",
                      active && "bg-accent-soft font-medium text-accent-fg"
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {active && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
