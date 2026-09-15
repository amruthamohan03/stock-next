"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm";
import { Upload, FileText, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiDelete } from "@/lib/api-client";

export type Bill = { path: string; name: string | null; type: string | null };

export default function BillAttachment({
  indentId,
  bill,
}: {
  indentId: number;
  bill: Bill | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ver, setVer] = useState(0);

  const src = `/api/indent/bill?id=${indentId}&v=${ver}`;
  const isImage = (bill?.type ?? "").startsWith("image/");
  const isPdf = bill?.type === "application/pdf";

  const upload = async (file: File) => {
    setError(null);
    setBusy(true);
    const fd = new FormData();
    fd.append("id", String(indentId));
    fd.append("file", file);
    const res = await fetch("/api/indent/bill", { method: "POST", body: fd });
    const json = await res.json();
    setBusy(false);
    if (json.success) {
      setVer((v) => v + 1);
      router.refresh();
    } else {
      setError(json.message ?? "Upload failed");
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Remove the attached bill?",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const result = await apiDelete(`/api/indent/bill?id=${indentId}`);
    setBusy(false);
    if (result.success) router.refresh();
    else setError(result.message);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        onChange={onPick}
        className="hidden"
      />

      {error && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
          {error}
        </div>
      )}

      {bill ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
              <FileText className="h-4 w-4 shrink-0 text-accent" />
              <span className="truncate text-fg">{bill.name || "bill"}</span>
            </div>
            <div className="flex items-center gap-2">
              <a href={src} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" type="button">
                  <ExternalLink className="h-4 w-4" /> Open
                </Button>
              </a>
              <Button variant="outline" size="sm" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Replace
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={busy}
                onClick={remove}
                className="text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            </div>
          </div>

          {/* Preview */}
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={bill.name || "Bill"}
              className="max-h-[28rem] w-auto rounded-lg border border-line"
            />
          ) : isPdf ? (
            <object data={src} type="application/pdf" className="h-[32rem] w-full rounded-lg border border-line">
              <p className="p-4 text-sm text-muted">
                PDF preview isn&apos;t supported here — use <span className="text-fg">Open</span> above.
              </p>
            </object>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-elevated/50 px-4 py-8 text-sm text-muted transition-colors hover:border-accent hover:text-fg disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
          <span>{busy ? "Uploading…" : "Click to upload a bill (image or PDF, ≤ 10 MB)"}</span>
        </button>
      )}
    </div>
  );
}
