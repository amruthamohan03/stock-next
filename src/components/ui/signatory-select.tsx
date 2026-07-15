"use client";

import { SearchableSelect } from "./searchable-select";
import type { Signatory } from "@/lib/signatories";

/** Pick the person who SIGNS a KFC form / document (may differ from the creator).
 *  On select, hands back the chosen id + their name + designation so the caller
 *  can fill the printed signatory block (still editable afterwards). */
export function SignatorySelect({
  signatories,
  value,
  onPick,
  id,
}: {
  signatories: Signatory[];
  value: string;
  onPick: (s: { id: string; name: string; designation: string }) => void;
  id?: string;
}) {
  const options = signatories.map((s) => ({
    value: s.id,
    label: s.designation ? `${s.name} — ${s.designation}` : s.name,
  }));

  return (
    <SearchableSelect
      id={id}
      value={value}
      options={options}
      placeholder="Select signatory…"
      onChange={(v) => {
        const s = signatories.find((x) => String(x.id) === v);
        onPick({ id: v, name: s?.name ?? "", designation: s?.designation ?? "" });
      }}
    />
  );
}
