"use client";

import { useEffect } from "react";

/**
 * Opens the print dialog once, on mount.
 *
 * Used by the list's Print action, which navigates to the view page with
 * `?print=1` so the printed output is the real sheet rather than a second
 * rendering that could drift from it.
 */
export default function AutoPrint() {
  useEffect(() => {
    // Wait a frame so the sheet (and its fonts) have painted before the
    // dialog snapshots the page.
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
