"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiPut } from "@/lib/api-client";
import { RULES } from "@/lib/income-tax";
import type { YearStatus } from "@/lib/income-tax-queries";

/** Financial years with their lock state; open a past year to work on it. */
export default function YearLocks({
  years,
  canManage,
}: {
  years: YearStatus[];
  /** "Approve" right on the Income Tax menu — only then are the buttons shown. */
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (y: YearStatus) => {
    const locking = !y.locked;
    const ok = await confirm({
      title: `${locking ? "Lock" : "Unlock"} FY ${y.financial_year}?`,
      description: locking
        ? "Its statements become read-only — nobody can add, edit or delete them until it is unlocked."
        : "Statements for this year can then be added, edited and deleted again.",
      confirmLabel: locking ? "Lock" : "Unlock",
    });
    if (!ok) return;
    setBusy(y.financial_year);
    const result = await apiPut("/api/income-tax/years", {
      financial_year: y.financial_year,
      locked: locking,
    });
    setBusy(null);
    if (toast.fromResult(result)) router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Years</CardTitle>
        <span className="text-sm text-faint">Locked years are read-only</span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {years.map((y) => (
            <div
              key={y.financial_year}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                y.locked ? "border-line bg-elevated" : "border-emerald-500/40 bg-emerald-500/10"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    y.locked ? "bg-card text-faint" : "bg-emerald-500/15 text-emerald-500"
                  }`}
                >
                  {y.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-fg">FY {y.financial_year}</div>
                  <div className="truncate text-xs text-muted">
                    {RULES[y.financial_year].label.replace(/^FY \S+ /, "")} · {y.statements}{" "}
                    statement{y.statements === 1 ? "" : "s"} · {y.locked ? "Locked" : "Open"}
                  </div>
                </div>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  variant={y.locked ? "primary" : "outline"}
                  onClick={() => toggle(y)}
                  loading={busy === y.financial_year}
                >
                  {y.locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {y.locked ? "Unlock" : "Lock"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
