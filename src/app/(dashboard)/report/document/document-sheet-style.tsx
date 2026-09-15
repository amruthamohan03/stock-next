/**
 * Styling for the document sheet — the rich-text body, the dashed signatory
 * fields, and the print rules that turn it into an A4 page.
 *
 * Shared by the builder (editing) and the read-only view page so the printed
 * output is identical from either, and the print fixes live in one place.
 */
export default function DocumentSheetStyle() {
  return (
    <style>{`
      .doc-body { font-size: 13px; line-height: 1.65; color: #1e293b; }
      .doc-body p { margin: 0 0 10px; text-align: justify; }
      .doc-body h3 { font-weight: 700; color: #1f4e79; font-size: 14px; margin: 14px 0 8px; }
      .doc-body ul { list-style: disc; padding-left: 1.5rem; margin: 0 0 10px; }
      .doc-body ol { list-style: decimal; padding-left: 1.5rem; margin: 0 0 10px; }
      .doc-body table { border-collapse: collapse; width: 100%; margin: 10px 0; }
      .doc-body th, .doc-body td { border: 1px solid #334155; padding: 4px 8px; text-align: left; vertical-align: top; font-size: 13px; }
      .doc-field { border-bottom: 1px dashed #cbd5e1; }
      .print-only { display: none; }
      @media print {
        aside, header, .no-print { display: none !important; }
        main { padding: 0 !important; background: #fff !important; }
        /* The shared .printable rule pins reports with position:absolute, which
           clips a document that spans pages. Everything else on this page is
           already display:none above, so the sheet can flow normally instead. */
        .doc-sheet {
          position: static !important;
          width: auto !important;
          border: 0 !important;
          box-shadow: none !important;
          max-width: none !important;
          margin: 0 !important;
          /* @page keeps the side margins but has none top or bottom, so the
             sheet supplies those itself. */
          padding: 18mm 0 !important;
        }
        .doc-field { border-bottom: 0 !important; }
        .print-only { display: block !important; }
        .doc-body th, .doc-body td { border: 1px solid #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        /* Chrome paints its page header/footer (title, URL, page number, date)
           inside the top and bottom @page margin boxes. With no margin there,
           they are omitted. Side margins stay native so they apply per page. */
        @page { size: A4 portrait; margin: 0 18mm; }
      }
    `}</style>
  );
}
