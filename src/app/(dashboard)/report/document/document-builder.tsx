"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { usePrompt } from "@/components/ui/confirm";
import { apiRequest } from "@/lib/api-client";
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
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SignatorySelect } from "@/components/ui/signatory-select";
import type { Signatory } from "@/lib/signatories";
import type { KfcFormOption } from "@/lib/kfc-forms";
import DocumentSheetStyle from "./document-sheet-style";
import DocumentStatus from "./document-status";
import DocumentRemarks, { type DocumentRemark } from "./document-remarks";
import { isLocked } from "@/lib/document-status";
import DocumentAttachment from "./document-attachment";

type TemplateKey = "submission" | "justification" | "essentiality" | "custom";

export type DocumentInitial = {
  id: number;
  title: string;
  doc_type: string;
  body: string;
  place: string;
  doc_date: string;
  submitted_name: string;
  designation: string;
  department: string;
  institution: string;
  signed_by: string;
  attachment_name?: string | null;
  attachment_type?: string | null;
  status: string;
  remarks: DocumentRemark[];
};

const TEMPLATES: Record<TemplateKey, { label: string; title: string; body: string }> = {
  submission: {
    label: "Submission",
    title: "Submission",
    body: `<p>I hereby submit the proposal for the purchase of <b>[non-consumable equipment]</b> as part of the Annual Purchase for the financial year 2026-27.</p>
<p>Item Type: [Non-Consumables]<br>Proposed Amount: Rs. [amount]/-</p>
<div data-kfc-proposal><p><em>Select a KFC form in “Based on KFC Form” above to insert the proposal items and total here.</em></p></div>
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

const inr = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Put the proposal `blockHtml` into the document's proposal position.
 *  1. If the template's [data-kfc-proposal] slot exists → fill it.
 *  2. Otherwise (older documents), remove any existing proposal blocks — the
 *     static "Proposal" table and any previously inserted "Proposal — based on…"
 *     block — and insert the fresh one where the first one was.
 *  3. If there's no proposal at all → append at the end.
 * A "block" is an <h3> heading + the following <table> + the following Total <p>.
 */
function placeProposal(editor: HTMLElement, blockHtml: string) {
  const slot = editor.querySelector("[data-kfc-proposal]");
  if (slot) {
    slot.innerHTML = blockHtml;
    return;
  }

  const isProposalHead = (h: Element) => {
    const t = (h.textContent ?? "").trim().toLowerCase();
    return t === "proposal" || t.startsWith("proposal —") || t.startsWith("proposal -");
  };
  const heads = Array.from(editor.querySelectorAll("h3")).filter(isProposalHead);

  if (heads.length === 0) {
    editor.innerHTML += blockHtml;
    return;
  }

  // Insert the new content just before the first existing proposal heading…
  const wrap = document.createElement("div");
  wrap.innerHTML = blockHtml;
  const anchor = heads[0];
  const parent = anchor.parentNode;
  if (parent) while (wrap.firstChild) parent.insertBefore(wrap.firstChild, anchor);

  // …then remove every old proposal block (heading + its table + its total).
  for (const h of heads) {
    const next = h.nextElementSibling;
    const table = next && next.tagName === "TABLE" ? next : null;
    const afterTable = table ? table.nextElementSibling : next;
    const totalP =
      afterTable && afterTable.tagName === "P" && /^total/i.test((afterTable.textContent ?? "").trim())
        ? afterTable
        : null;
    h.remove();
    table?.remove();
    totalP?.remove();
  }
}

export default function DocumentBuilder({
  defaultName,
  defaultDesignation,
  signatories,
  kfcForms = [],
  initial,
  isSuperAdmin = false,
}: {
  defaultName: string;
  defaultDesignation: string;
  signatories: Signatory[];
  kfcForms?: KfcFormOption[];
  initial?: DocumentInitial;
  isSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const prompt = usePrompt();
  const editing = !!initial;
  // A submitted document is final: everything on this page goes read-only.
  // Super Admin edits by reopening it first, not by bypassing the lock here.
  const locked = isLocked(initial?.status);
  const editorRef = useRef<HTMLDivElement>(null);
  const [docType, setDocType] = useState<TemplateKey>(
    (initial?.doc_type as TemplateKey) || "submission"
  );
  const [title, setTitle] = useState(initial?.title ?? TEMPLATES.submission.title);

  const [place, setPlace] = useState(initial?.place ?? "Nedumkandam");
  const [date, setDate] = useState(initial?.doc_date || todayIso());
  const [name, setName] = useState(initial?.submitted_name ?? defaultName);
  const [designation, setDesignation] = useState(
    initial?.designation ?? defaultDesignation ?? "HoD-In-Charge"
  );
  const [department, setDepartment] = useState(
    initial?.department ?? "Department of Computer Engineering"
  );
  const [institution, setInstitution] = useState(initial?.institution ?? "GPTC Nedumkandam");
  const [signedBy, setSignedBy] = useState(initial?.signed_by ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Seed the editor once on mount (existing body when editing, else a template).
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initial?.body || TEMPLATES.submission.body;
    }
  }, [initial]);

  const applyTemplate = (key: TemplateKey) => {
    if (locked) return;
    setDocType(key);
    setTitle(TEMPLATES[key].title);
    if (editorRef.current) editorRef.current.innerHTML = TEMPLATES[key].body;
  };

  // Pull a saved KFC form's date, item table and total into the document.
  const [basing, setBasing] = useState(false);
  const prefillFromKfc = async (encoded: string) => {
    if (!encoded || locked) return;
    const [kind, id] = encoded.split(":");
    setMsg(null);
    setBasing(true);
    try {
      const result = await apiRequest(`/api/kfc-form?kind=${kind}&id=${id}`);
      if (!result.success) {
        const text = result.message || "Could not load the KFC form";
        setMsg({ ok: false, text });
        toast.error(text);
        return;
      }
      const { title: formTitle, date: formDate, items, total } = (
        result.data as { data: unknown }
      ).data as {
        title: string;
        date: string | null;
        items: { sl: number; name: string; qty: number; rate: number; amount: number }[];
        total: number;
      };

      if (formDate) setDate(String(formDate).slice(0, 10));

      const rowsHtml = items
        .map(
          (it) =>
            `<tr><td>${it.sl}</td><td>${escHtml(it.name)}</td><td>${it.qty || ""}</td><td>${
              it.rate ? inr(it.rate) : ""
            }</td><td>${it.amount ? inr(it.amount) : ""}</td></tr>`
        )
        .join("");

      const dateLabel = formDate ? String(formDate).slice(0, 10).split("-").reverse().join(".") : "";
      const block =
        `<h3>Proposal — based on ${escHtml(formTitle)}${dateLabel ? ` dated ${dateLabel}` : ""}</h3>` +
        `<table><thead><tr><th>Sl.No</th><th>Item</th><th>Qty</th><th>Rate (Rs.)</th><th>Amount (Rs.)</th></tr></thead>` +
        `<tbody>${rowsHtml}</tbody></table>` +
        `<p>Total: Rs. ${inr(total)}/-</p>`;

      // Fill the proposal slot (or replace an older static/inserted proposal).
      if (editorRef.current) placeProposal(editorRef.current, block);

      setMsg({ ok: true, text: `Inserted ${items.length} item(s) from “${formTitle}” into the proposal.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBasing(false);
    }
  };

  const save = async () => {
    if (locked) return;
    setMsg(null);
    if (!title.trim()) {
      setMsg({ ok: false, text: "Title is required." });
      return;
    }
    setSaving(true);
    const result = await apiRequest("/api/document", {
      method: editing ? "PUT" : "POST",
      body: {
        id: initial?.id,
        title,
        doc_type: docType,
        body: editorRef.current?.innerHTML ?? "",
        place,
        doc_date: date,
        submitted_name: name,
        designation,
        department,
        institution,
        signed_by: signedBy || null,
      },
    });
    setSaving(false);
    if (result.success) {
      toast.success(result.message || `${editing ? "Updated" : "Saved"} Document`);
      router.push("/report/document");
      router.refresh();
    } else {
      // Keep the inline banner too: the editor is long, and the toast may
      // scroll out of view before the user reaches the Save button again.
      setMsg({ ok: false, text: result.message });
      toast.error(result.message);
    }
  };

  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const insertTable = async () => {
    const cols = Number(
      await prompt({ title: "Insert table", description: "How many columns?", defaultValue: "3", type: "number" })
    );
    const rows = Number(
      await prompt({ title: "Insert table", description: "How many rows?", defaultValue: "3", type: "number" })
    );
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
          <CardTitle>{editing ? "Edit Document" : "Document Builder"}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/report/document")}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            {!locked && (
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Saving…" : editing ? "Update" : "Save"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {msg && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.ok ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
              }`}
            >
              {msg.text}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <Label>Document type</Label>
              <SearchableSelect
                value={docType}
                onChange={(v) => applyTemplate(v as TemplateKey)}
                options={Object.entries(TEMPLATES).map(([k, t]) => ({ value: k, label: t.label }))}
              />
            </div>
            <div className="w-64">
              <Label>Signed by</Label>
              <SignatorySelect
                signatories={signatories}
                value={signedBy}
                onPick={(sgn) => {
                  setSignedBy(sgn.id);
                  setName(sgn.name);
                  if (sgn.designation) setDesignation(sgn.designation);
                }}
              />
            </div>
            {kfcForms.length > 0 && (
              <div className="w-72">
                <Label>Based on KFC Form {basing && <span className="text-faint">(loading…)</span>}</Label>
                <SearchableSelect
                  value=""
                  onChange={prefillFromKfc}
                  options={kfcForms}
                  placeholder="Insert items from a KFC form…"
                />
              </div>
            )}
            <p className="pb-2 text-xs text-faint">
              Picking a signatory fills the name &amp; designation block below. Picking a
              KFC form inserts its date, items &amp; total into the document.
            </p>
          </div>

          {/* Formatting toolbar */}
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-line p-1">
            {tools.map((t) => (
              <button
                key={t.label}
                type="button"
                title={t.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={t.run}
                className="rounded p-2 text-muted hover:bg-elevated hover:text-fg"
              >
                <t.icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workflow status — only meaningful once the document has an id */}
      {editing && (
        <Card className="no-print">
          <CardContent className="pt-5">
            <DocumentStatus
              documentId={initial!.id}
              status={initial!.status}
              isSuperAdmin={isSuperAdmin}
            />
          </CardContent>
        </Card>
      )}

      {/* Remarks — a dated trail against the document, frozen once submitted */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Remarks</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <DocumentRemarks
              documentId={initial!.id}
              remarks={initial!.remarks}
              locked={locked}
            />
          ) : (
            <p className="text-sm text-muted">
              Save this document first, then reopen it to add remarks.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Attachment (PDF / image) — needs a saved document to attach to */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Attachment (PDF / Image)</CardTitle>
        </CardHeader>
        <CardContent>
          {locked ? (
            <p className="text-sm text-muted">
              This document is submitted and locked — its attachment can no longer be changed.
            </p>
          ) : editing ? (
            <DocumentAttachment
              documentId={initial!.id}
              attachment={
                initial!.attachment_name
                  ? { name: initial!.attachment_name, type: initial!.attachment_type ?? null }
                  : null
              }
            />
          ) : (
            <p className="text-sm text-muted">
              Save this document first, then reopen it to attach a PDF or image.
            </p>
          )}
        </CardContent>
      </Card>

      {/* The document sheet (WYSIWYG + print target) */}
      <div className="printable doc-sheet mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-10 shadow-sm">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          readOnly={locked}
          className="mb-6 w-full bg-transparent text-center text-xl font-bold tracking-wide text-[#1f4e79] outline-none focus:bg-brand-50/50"
        />

        <div
          ref={editorRef}
          className="doc-body min-h-[240px] focus:outline-none"
          contentEditable={!locked}
          suppressContentEditableWarning
        />

        {/* Submitted-by / place / date block */}
        <div className="mt-16 flex items-end justify-between gap-6 text-sm">
          <div className="space-y-1">
            <input value={place} onChange={(e) => setPlace(e.target.value)} readOnly={locked} className={`${field} w-40`} placeholder="Place" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              readOnly={locked}
              className={`${field} no-print block w-40`}
            />
            {/* printed date (dd.mm.yyyy) */}
            <div className="print-only text-slate-800">{fmtDate(date)}</div>
          </div>
          <div className="space-y-1 text-right">
            <input value={name} onChange={(e) => setName(e.target.value)} readOnly={locked} className={`${field} w-64 text-right font-medium`} placeholder="Name" />
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} readOnly={locked} className={`${field} w-64 text-right`} placeholder="Designation" />
            <input value={department} onChange={(e) => setDepartment(e.target.value)} readOnly={locked} className={`${field} w-64 text-right`} placeholder="Department" />
            <input value={institution} onChange={(e) => setInstitution(e.target.value)} readOnly={locked} className={`${field} w-64 text-right`} placeholder="Institution" />
          </div>
        </div>
      </div>

      <DocumentSheetStyle />
    </div>
  );
}
