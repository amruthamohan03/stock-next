"use client";

import { Check } from "lucide-react";

/**
 * A labelled on/off box for a form flag — "No entry in stock register",
 * "No indent entry" and the like.
 *
 * A plain checkbox is hard to theme and easy to miss next to the app's other
 * controls, so this matches the height and framing of an Input and shows the
 * state as a filled accent square.
 */
export function CheckToggle({
  id,
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  id?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** Short line under the label explaining what the flag means. */
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? "border-accent/50 bg-accent-soft"
          : "border-line bg-elevated hover:border-faint"
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked ? "border-transparent bg-accent text-on-accent" : "border-line bg-card"
        }`}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-medium ${checked ? "text-accent-fg" : "text-fg"}`}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}
