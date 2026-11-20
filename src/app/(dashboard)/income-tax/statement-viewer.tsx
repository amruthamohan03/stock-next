"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { compareRegimes, type Regime, type TaxData } from "@/lib/income-tax";
import { Form12bbPage, SheetStyle, StatementPages, type SheetHeader } from "./statement-print";

type View = Regime | "BOTH" | "12BB";

const TABS: { key: View; label: string }[] = [
  { key: "OLD", label: "Old Regime" },
  { key: "NEW", label: "New Regime" },
  { key: "BOTH", label: "Both" },
  { key: "12BB", label: "Form 12BB" },
];

/**
 * A4 preview of the printable sheets — the pages exactly as they print.
 * Print / Save as PDF prints whatever tab is showing; choosing "Save as PDF"
 * in the print dialog gives the PDF.
 */
export default function StatementViewer({
  header,
  data,
  regime,
  printedAt,
  credit,
  actions,
}: {
  header: SheetHeader;
  data: TaxData;
  /** The regime opted — the tab that opens first. */
  regime: Regime;
  printedAt: string;
  credit: string;
  actions?: ReactNode;
}) {
  const [view, setView] = useState<View>(regime);
  const both = useMemo(
    () => compareRegimes(data, header.category, header.financial_year),
    [data, header.category, header.financial_year]
  );
  const pages = (r: Regime) => (
    <StatementPages key={r} header={header} data={data} result={both[r]} printedAt={printedAt} credit={credit} />
  );

  return (
    <Card>
      <CardHeader className="no-print flex-wrap gap-2">
        <CardTitle>
          {header.employee_name} · FY {header.financial_year}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="flex rounded-lg border border-line bg-elevated p-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={view === t.key}
                onClick={() => setView(t.key)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  view === t.key ? "bg-card text-fg shadow-sm" : "text-muted hover:text-fg"
                }`}
              >
                {t.label}
                {t.key === regime && <span className="ml-1 text-xs text-accent">(opted)</span>}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" type="button" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto bg-surface py-6 print:overflow-visible print:p-0">
        <SheetStyle />
        <div className="printable">
          {view === "12BB" ? (
            <Form12bbPage header={header} data={data} result={both.OLD} printedAt={printedAt} />
          ) : view === "BOTH" ? (
            [pages("OLD"), pages("NEW")]
          ) : (
            pages(view)
          )}
        </div>
      </CardContent>
    </Card>
  );
}
