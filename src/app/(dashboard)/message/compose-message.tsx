"use client";

import { useRef, useState } from "react";
import {
  Mail,
  MessageCircle,
  Send,
  Loader2,
  Paperclip,
  X,
  Bold,
  Italic,
  Underline,
  Heading,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eraser,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // keep in sync with the API route
const fmtSize = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;

export default function ComposeMessage() {
  // Rich-text body. Kept in a ref (not state) so typing never re-renders and
  // resets the caret; we read innerHTML / innerText when sending.
  const editorRef = useRef<HTMLDivElement>(null);
  const readHtml = () => editorRef.current?.innerHTML ?? "";
  const readText = () => editorRef.current?.innerText ?? "";

  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const tools: { icon: React.ComponentType<{ className?: string }>; label: string; run: () => void }[] = [
    { icon: Bold, label: "Bold", run: () => exec("bold") },
    { icon: Italic, label: "Italic", run: () => exec("italic") },
    { icon: Underline, label: "Underline", run: () => exec("underline") },
    { icon: Heading, label: "Heading", run: () => exec("formatBlock", "H3") },
    { icon: List, label: "Bullet list", run: () => exec("insertUnorderedList") },
    { icon: ListOrdered, label: "Numbered list", run: () => exec("insertOrderedList") },
    { icon: AlignLeft, label: "Align left", run: () => exec("justifyLeft") },
    { icon: AlignCenter, label: "Align center", run: () => exec("justifyCenter") },
    { icon: AlignRight, label: "Align right", run: () => exec("justifyRight") },
    { icon: Eraser, label: "Clear formatting", run: () => exec("removeFormat") },
  ];

  // Email
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
    e.target.value = ""; // allow re-picking the same file
  };
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, n) => n !== i));

  // WhatsApp
  const [phone, setPhone] = useState("");
  const [waMsg, setWaMsg] = useState<string | null>(null);

  const sendEmail = async () => {
    setEmailMsg(null);
    if (!readText().trim()) return setEmailMsg({ ok: false, text: "Type a message first." });
    if (!to.trim()) return setEmailMsg({ ok: false, text: "Enter a recipient email." });
    if (totalSize > MAX_TOTAL_BYTES)
      return setEmailMsg({
        ok: false,
        text: `Attachments total ${fmtSize(totalSize)} — the limit is ${fmtSize(MAX_TOTAL_BYTES)}.`,
      });

    setSending(true);
    const fd = new FormData();
    fd.append("to", to);
    fd.append("subject", subject);
    // Plain text for the text/plain part; HTML for the styled version.
    fd.append("message", readText());
    fd.append("messageHtml", readHtml());
    for (const f of files) fd.append("files", f);

    const res = await fetch("/api/message/email", { method: "POST", body: fd });
    const json = await res.json();
    setSending(false);
    setEmailMsg({ ok: !!json.success, text: json.message ?? (json.success ? "Sent." : "Failed.") });
    if (json.success) setFiles([]);
  };

  const sendWhatsApp = () => {
    setWaMsg(null);
    // WhatsApp links carry plain text only — use the editor's text, not its HTML.
    const text = readText().trim();
    if (!text) return setWaMsg("Type a message first.");
    const digits = phone.replace(/[^\d]/g, ""); // country code + number, digits only
    const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
    const url = `${base}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
    setWaMsg(
      digits
        ? "Opening WhatsApp… press Send there to deliver."
        : "Opening WhatsApp — pick a contact, then press Send."
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-fg">Send Message</h1>
        <p className="text-sm text-muted">
          Compose a message and send it by email or WhatsApp.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Message</Label>

          {/* Formatting toolbar */}
          <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-line bg-elevated p-1">
            {tools.map((t) => (
              <button
                key={t.label}
                type="button"
                title={t.label}
                onMouseDown={(e) => e.preventDefault()} // keep the caret/selection
                onClick={t.run}
                className="rounded p-2 text-muted transition-colors hover:bg-card hover:text-fg"
              >
                <t.icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Type your message here…"
            className="msg-body min-h-[10rem] w-full rounded-b-lg border border-t-0 border-line bg-elevated px-3 py-2 text-sm text-fg shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />

          <p className="mt-1 text-xs text-faint">
            Formatting is used in the email. WhatsApp gets the plain text version
            (formatting is dropped there).
          </p>

          <style>{`
            .msg-body:empty:before {
              content: attr(data-placeholder);
              color: var(--faint);
            }
            .msg-body p { margin: 0 0 8px; }
            .msg-body h3 { font-weight: 700; font-size: 1rem; margin: 10px 0 6px; }
            .msg-body ul { list-style: disc; padding-left: 1.4rem; margin: 0 0 8px; }
            .msg-body ol { list-style: decimal; padding-left: 1.4rem; margin: 0 0 8px; }
          `}</style>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent" /> Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="name@example.com (comma-separate for several)"
              />
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line"
              />
            </div>
            {/* Attachments */}
            <div>
              <Label>Attachments</Label>
              <input
                ref={fileRef}
                type="file"
                multiple
                onChange={addFiles}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-elevated/50 px-3 py-2.5 text-sm text-muted transition-colors hover:border-accent hover:text-fg"
              >
                <Paperclip className="h-4 w-4" /> Attach files
              </button>

              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-line bg-elevated px-2.5 py-1.5 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate text-fg">{f.name}</span>
                      <span className="shrink-0 text-faint">{fmtSize(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="shrink-0 rounded p-0.5 text-muted hover:bg-red-500/10 hover:text-red-500"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {files.length > 0 && (
                <p
                  className={`mt-1 text-xs ${
                    totalSize > MAX_TOTAL_BYTES ? "text-red-500" : "text-faint"
                  }`}
                >
                  {files.length} file(s) · {fmtSize(totalSize)} of {fmtSize(MAX_TOTAL_BYTES)}
                </p>
              )}
            </div>

            {emailMsg && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ring-1 ${
                  emailMsg.ok
                    ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20"
                    : "bg-red-500/10 text-red-500 ring-red-500/20"
                }`}
              >
                {emailMsg.text}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={sendEmail} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Sending…" : "Send Email"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-500" /> WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="phone">Phone number (with country code)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 91 98765 43210"
                inputMode="tel"
              />
              <p className="mt-1 text-xs text-faint">
                Include the country code (91 for India). Leave blank to pick a contact in WhatsApp.
              </p>
              <p className="mt-1 text-xs text-faint">
                WhatsApp sends the message text only — attachments go by email. You can
                add files in WhatsApp yourself before pressing Send.
              </p>
            </div>
            {waMsg && (
              <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500 ring-1 ring-emerald-500/20">
                {waMsg}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                onClick={sendWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-600/90"
              >
                <MessageCircle className="h-4 w-4" /> Send via WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
