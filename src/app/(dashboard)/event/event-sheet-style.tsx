/**
 * Print styling shared by every event printout — duty list, participant
 * register, score card and certificates.
 *
 * Carries the same two fixes the KFC/document sheets needed:
 *  - `position: static` overrides the shared `.printable` rule, whose
 *    `position: absolute` clips a table that runs past one page.
 *  - `@page` has no top/bottom margin, because Chrome paints its header and
 *    footer (title, URL, page number, date) inside those margin boxes. The
 *    sheet supplies the vertical space itself.
 */
export default function EventSheetStyle({
  landscape = false,
}: {
  /** Landscape for the wide duty list and the certificates. */
  landscape?: boolean;
}) {
  return (
    <style>{`
      .evt-table { border-collapse: collapse; width: 100%; }
      .evt-table th, .evt-table td { border: 1px solid #334155; padding: 4px 6px; font-size: 12px; }
      .evt-table th { background: rgba(100,116,139,.12); text-align: center; font-weight: 600; }
      @media print {
        aside, header, .no-print { display: none !important; }
        main { padding: 0 !important; background: #fff !important; overflow: visible !important; }
        .evt-sheet {
          position: static !important;
          width: auto !important;
          margin: 0 !important;
          border: 0 !important;
          box-shadow: none !important;
          max-width: none !important;
          padding: 10mm 0 !important;
          background: #fff !important;
          color: #000 !important;
          font-family: "Times New Roman", Times, serif !important;
        }
        .evt-sheet * { color: #000 !important; }
        .evt-table th, .evt-table td {
          border: 1px solid #000 !important;
          background: transparent !important;
          font-size: 10px !important;
          line-height: 1.3 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .evt-table td { overflow-wrap: anywhere; }
        .evt-table thead { display: table-header-group; }
        .evt-row { break-inside: avoid; page-break-inside: avoid; }
        .evt-page { break-after: page; page-break-after: always; }
        .evt-page:last-child { break-after: auto; page-break-after: auto; }
        @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 0 12mm; }
      }
    `}</style>
  );
}
