"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { inr, money, type LineItem } from "@/lib/income-tax";

/** A whole-rupee amount box; 0 shows as empty so the form reads clean. */
export function Money({
  label,
  hint,
  value,
  onChange,
  onFocus,
  onBlur,
  className,
}: {
  label?: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
}) {
  const input = (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      value={value || ""}
      placeholder="0"
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(e) => onChange(money(e.target.value))}
      className={`text-right tabular-nums ${className ?? ""}`}
      aria-label={label}
    />
  );
  if (!label) return input;
  return (
    <div>
      <Label>{label}</Label>
      {input}
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

/** A worked figure shown where an input would be — read, not typed. */
export function Computed({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex h-9 items-center justify-end rounded-[0.65rem] border border-dashed border-line bg-surface px-3 text-sm font-semibold tabular-nums text-fg">
        {inr(value)}
      </div>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

/** One Money box per field definition, bound to a record of amounts. */
export function MoneyFields<K extends string>({
  fields,
  values,
  onChange,
}: {
  fields: readonly { key: K; label: string; hint?: string }[];
  values: Record<K, number>;
  onChange: (key: K, value: number) => void;
}) {
  return (
    <>
      {fields.map((f) => (
        <Money key={f.key} label={f.label} hint={f.hint} value={values[f.key]} onChange={(v) => onChange(f.key, v)} />
      ))}
    </>
  );
}

/** Free-text rows ("Any other", challans, banks) — description + amount. */
export function LineItems({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const update = (i: number, patch: Partial<LineItem>) =>
    onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2 sm:col-span-2 lg:col-span-4">
      {items.map((x, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={x.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder={placeholder}
            aria-label="Description"
          />
          <div className="w-40 shrink-0">
            <Money value={x.amount} onChange={(amount) => update(i, { amount })} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            title="Remove"
            aria-label="Remove row"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="soft" size="sm" type="button" onClick={() => onChange([...items, { label: "", amount: 0 }])}>
        <Plus className="h-4 w-4" /> {addLabel}
      </Button>
    </div>
  );
}
