"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, Lock, Pencil, Trash2 } from "lucide-react";
import DataTable, { type Column } from "@/components/data-table";
import CardGrid from "@/components/card-grid";
import { TableAction, TableActions } from "@/components/ui/table-action";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete } from "@/lib/api-client";
import { REGIME_LABEL, inr, toRegime } from "@/lib/income-tax";

export type StatementRow = {
  id: number;
  financial_year: string;
  employee_name: string;
  designation: string | null;
  pan: string | null;
  regime: string | null;
  gross_income: number;
  taxable_income: number;
  total_tax: number;
  balance_tax: number;
};

const REGIME_TINT = {
  NEW: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  OLD: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
} as const;

function RegimeBadge({ regime }: { regime: string | null }) {
  const r = toRegime(regime);
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${REGIME_TINT[r]}`}
    >
      {r === "NEW" ? "New regime" : "Old regime"}
    </span>
  );
}

/** Balance due reads amber; a refund reads green. */
const balanceText = (n: number) =>
  n > 0 ? "text-amber-500" : n < 0 ? "text-emerald-500" : "text-muted";

function StatementCard({ row, locked }: { row: StatementRow; locked: boolean }) {
  const figures: [string, number][] = [
    ["Gross income", row.gross_income],
    ["Taxable income", row.taxable_income],
    ["Tax payable", row.total_tax],
  ];
  return (
    <Link
      href={`/income-tax/${row.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-card transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2 border-b border-line p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-fg">{row.employee_name}</h3>
          <p className="truncate text-xs text-muted">
            {[row.designation, row.pan].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[11px] font-medium text-muted">
          {locked && <Lock className="h-3 w-3" aria-label="Locked" />}
          FY {row.financial_year}
        </span>
      </div>
      <div className="space-y-2 p-4 text-sm">
        {figures.map(([label, n]) => (
          <div key={label} className="flex justify-between gap-2">
            <span className="text-muted">{label}</span>
            <span className="tabular-nums text-fg">{inr(n)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-2 border-t border-line pt-2 font-semibold">
          <span className="text-muted">{row.balance_tax < 0 ? "Refund due" : "Balance"}</span>
          <span className={`tabular-nums ${balanceText(row.balance_tax)}`}>
            {inr(Math.abs(row.balance_tax))}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <RegimeBadge regime={row.regime} />
          <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>
      </div>
    </Link>
  );
}

export default function StatementList({
  rows,
  locked,
  actions,
}: {
  rows: StatementRow[];
  /** Locked financial years — their rows offer no edit or delete. */
  locked: string[];
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState<number | null>(null);

  const columns: Column<StatementRow>[] = useMemo(() => {
    const remove = async (row: StatementRow) => {
      const ok = await confirm({
        title: `Delete ${row.employee_name}'s statement for ${row.financial_year}?`,
        description: "It is soft-deleted, so it can be restored in the database.",
        confirmLabel: "Delete",
        tone: "danger",
      });
      if (!ok) return;
      setDeleting(row.id);
      const result = await apiDelete(`/api/income-tax?id=${row.id}`);
      setDeleting(null);
      if (toast.fromResult(result, { success: "Statement deleted" })) router.refresh();
    };
    const amount = (key: "gross_income" | "taxable_income" | "total_tax", label: string) => ({
      key,
      label,
      align: "right" as const,
      value: (r: StatementRow) => r[key],
      render: (r: StatementRow) => <span className="tabular-nums">{inr(r[key])}</span>,
    });

    return [
      { key: "_sl", label: "#", className: "w-12 text-faint", render: (_r, i) => i + 1 },
      {
        key: "employee_name",
        label: "Employee",
        value: (r) => `${r.employee_name} ${r.designation ?? ""} ${r.pan ?? ""}`,
        render: (r) => (
          <div className="min-w-0">
            <div className="font-medium text-fg">{r.employee_name}</div>
            <div className="text-xs text-muted">
              {[r.designation, r.pan].filter(Boolean).join(" · ")}
            </div>
          </div>
        ),
      },
      { key: "financial_year", label: "Year" },
      {
        key: "regime",
        label: "Regime",
        value: (r) => REGIME_LABEL[toRegime(r.regime)],
        render: (r) => <RegimeBadge regime={r.regime} />,
      },
      amount("gross_income", "Gross income"),
      amount("taxable_income", "Taxable"),
      amount("total_tax", "Tax"),
      {
        key: "balance_tax",
        label: "Balance",
        align: "right",
        value: (r) => r.balance_tax,
        render: (r) => (
          <span className={`font-medium tabular-nums ${balanceText(r.balance_tax)}`}>
            {inr(r.balance_tax)}
          </span>
        ),
      },
      {
        key: "_actions",
        label: "Actions",
        align: "right",
        className: "w-32",
        render: (r) => (
          <TableActions>
            <TableAction tone="view" icon={Eye} href={`/income-tax/${r.id}`} title="Open" />
            {locked.includes(r.financial_year) ? (
              <span
                className="inline-flex h-8 w-8 items-center justify-center text-faint"
                title={`FY ${r.financial_year} is locked`}
              >
                <Lock className="h-4 w-4" />
              </span>
            ) : (
              <>
                <TableAction tone="edit" icon={Pencil} href={`/income-tax/${r.id}/edit`} title="Edit" />
                <TableAction
                  tone="delete"
                  icon={Trash2}
                  onClick={() => remove(r)}
                  disabled={deleting === r.id}
                  title="Delete"
                />
              </>
            )}
          </TableActions>
        ),
      },
    ];
  }, [deleting, locked, confirm, toast, router]);

  return (
    <CardGrid
      title="Anticipatory Income Tax"
      subtitle="Statements for TDS from salary"
      rows={rows}
      searchText={(r) =>
        [r.employee_name, r.designation, r.pan, r.financial_year, REGIME_LABEL[toRegime(r.regime)]]
          .filter(Boolean)
          .join(" ")
      }
      card={(r) => <StatementCard row={r} locked={locked.includes(r.financial_year)} />}
      actions={actions}
      facets={[
        { label: "Year", value: (r) => r.financial_year },
        { label: "Regime", value: (r) => REGIME_LABEL[toRegime(r.regime)], sort: "asc" },
      ]}
      emptyState="No statements yet — add the first one."
      table={
        <DataTable title="Anticipatory Income Tax" columns={columns} rows={rows} minWidth="64rem" />
      }
    />
  );
}
