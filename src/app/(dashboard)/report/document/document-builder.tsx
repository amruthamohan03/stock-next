"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table as TableIcon,
  Eraser,
  Printer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";

type TemplateKey = "submission" | "justification" | "essentiality" | "custom";

const TEMPLATES: Record<TemplateKey, { label: string; title: string; body: string }> = {
  submission: {
    label: "Submission",
    title: "Submission",
    body: `<p>I hereby submit the proposal for the purchase of <b>[non-consumable equipment]</b> as part of the Annual Purchase for the financial year 2026-27.</p>
<p>Item Type: [Non-Consumables]<br>Proposed Amount: Rs. [amount]/-</p>
<h3>Proposal</h3>
<table><thead><tr><th>Sl.No</th><th>Item</th><th>Qty</th><th>Rate (Rs.)</th><th>Amount (Rs.)</th></tr></thead>
<tbody><tr><td>1</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td>2</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td>3</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table>
<p>Total: Rs. [amount]/- ([amount in words] Only)</p>
<p>Attachments:</p>
<ul><li>Essentiality Certificate</li><li>Justification Report</li><li>KFC form 13</li></ul>
<p>Kindly do the needful.</p>`,
  },
  justification: {
    label: "Justification Report",
    title: "Justification Report",
    body: `<p>The Department of [Department], Government Polytechnic College, Nedumkandam requires [items] to modernize laboratory infrastructure and support teaching-learning activities, programming laboratories, project development and departmental administration. The equipment will provide students with updated facilities and ensure uninterrupted, reliable operation during laboratory sessions. The total estimated expenditure is Rs. [amount]/-. Hence, sanction may kindly be accorded for the purchase.</p>`,
  },
  essentiality: {
    label: "Essentiality Certificate",
    title: "Essentiality Certificate",
    body: `<p>I hereby certify that the following items are essential for the smooth conduct of academic activities, laboratory practicals, project work, examinations and departmental administration.</p>
<table><thead><tr><th>#</th><th>Item</th></tr></thead>
<tbody><tr><td>1</td><td>&nbsp;</td></tr><tr><td>2</td><td>&nbsp;</td></tr><tr><td>3</td><td>&nbsp;</td></tr></tbody></table>`,
  },
  custom: {
    label: "Other / Custom",
    title: "Document Title",
    body: `<p>Start typing the document content here…</p>`,
  },
};

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const fmtDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

export default function DocumentBuilder({
  defaultName,
  defaultDesignation,
}: {
  defaultName: string;
  defaultDesignation: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [docType, setDocType] = useState<TemplateKey>("submission");
  const [title, setTitle] = useState(TEMPLATES.submission.title);

  const [place, setPlace] = useState("Nedumkandam");
  const [date, setDate] = useState(todayIso());
  const [name, setName] = useState(defaultName);
  const [designation, setDesignation] = useState(defaultDesignation || "HoD-In-Charge");
  const [department, setDepartment] = useState("Department of Computer Engineering");
  const [institution, setInstitution] = useState("GPTC Nedumkandam");

  // Seed the editor once on mount.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = TEMPLATES.submission.body;
  }, []);

  const applyTemplate = (key: TemplateKey) => {
    setDocType(key);
    setTitle(TEMPLATES[key].title);
    if (editorRef.current) editorRef.current.innerHTML = TEMPLATES[key].body;
  };

  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const insertTable = () => {
    const cols = Number(prompt("Number of columns?", "3"));
    const rows = Number(prompt("Number of rows?", "3"));
    if (!cols || !rows || cols < 1 || rows < 1) return;
    const cells = `<td>&nbsp;</td>`.repeat(cols);
    const body = `<tr>${cells}</tr>`.repeat(rows);
    exec("insertHTML", `<table><tbody>${body}</tbody></table><p>&nbsp;</p>`);
  };

  const tools: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    run: () => void;
  }[] = [
    { icon: Bold, label: "Bold", run: () => exec("bold") },
    { icon: Italic, label: "Italic", run: () => exec("italic") },
    { icon: Underline, label: "Underline", run: () => exec("underline") },
    { icon: Heading, label: "Heading", run: () => exec("formatBlock", "H3") },
    { icon: List, label: "Bullet list", run: () => exec("insertUnorderedList") },
    { icon: ListOrdered, label: "Numbered list", run: () => exec("insertOrderedList") },
    { icon: AlignLeft, label: "Align left", run: () => exec("justifyLeft") },
    { icon: AlignCenter, label: "Align center", run: () => exec("justifyCenter") },
    { icon: AlignRight, label: "Align right", run: () => exec("justifyRight") },
    { icon: TableIcon, label: "Insert table", run: insertTable },
    { icon: Eraser, label: "Clear formatting", run: () => exec("removeFormat") },
  ];

  const field =
    "doc-field bg-transparent outline-none focus:bg-brand-50/50";

  return (
    <div className="space-y-4">
      {/* Controls — hidden when printing */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Document Builder</CardTitle>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <Label>Document type</Label>
              <SearchableSelect
                value={docType}
                onChange={(v) => applyTemplate(v as TemplateKey)}
                options={Object.entries(TEMPLATES).map(([k, t]) => ({ value: k, label: t.label }))}
              />
            </div>
            <p className="pb-2 text-xs text-slate-400">
              Picking a type loads a starting template — edit everything below, then print.
            </p>
          </div>

          {/* Formatting toolbar */}
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 p-1">
            {tools.map((t) => (
              <button
                key={t.label}
                type="button"
                title={t.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={t.run}
                className="rounded p-2 text-slate-600 hover:bg-slate-100"
              >
                <t.icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* The document sheet (WYSIWYG + print target) */}
      <div className="doc-sheet mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-10 shadow-sm">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-6 w-full bg-transparent text-center text-xl font-bold tracking-wide text-[#1f4e79] outline-none focus:bg-brand-50/50"
        />

        <div
          ref={editorRef}
          className="doc-body min-h-[240px] focus:outline-none"
          contentEditable
          suppressContentEditableWarning
        />

        {/* Submitted-by / place / date block */}
        <div className="mt-16 flex items-end justify-between gap-6 text-sm">
          <div className="space-y-1">
            <input value={place} onChange={(e) => setPlace(e.target.value)} className={`${field} w-40`} placeholder="Place" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${field} no-print block w-40`}
            />
            {/* printed date (dd.mm.yyyy) */}
            <div className="print-only text-slate-800">{fmtDate(date)}</div>
          </div>
          <div className="space-y-1 text-right">
            <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} w-64 text-right font-medium`} placeholder="Name" />
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} className={`${field} w-64 text-right`} placeholder="Designation" />
            <input value={department} onChange={(e) => setDepartment(e.target.value)} className={`${field} w-64 text-right`} placeholder="Department" />
            <input value={institution} onChange={(e) => setInstitution(e.target.value)} className={`${field} w-64 text-right`} placeholder="Institution" />
          </div>
        </div>
      </div>

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
          .doc-sheet { border: 0 !important; box-shadow: none !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
          .doc-field { border-bottom: 0 !important; }
          .print-only { display: block !important; }
          .doc-body th, .doc-body td { border: 1px solid #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4 portrait; margin: 18mm; }
        }
      `}</style>
    </div>
  );
}
