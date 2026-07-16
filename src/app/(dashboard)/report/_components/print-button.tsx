"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Prints the current page. Report output is wrapped in `.printable`; the rest
 *  of the app chrome is hidden by the `@media print` rules in globals.css. */
export default function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" type="button" onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> {label}
    </Button>
  );
}
