"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api-client";
import type { ParsedSlip } from "@/lib/salary-slip";

export type UploadedSlip = ParsedSlip & { file: string; index: number };

type SlipResponse = { slips?: UploadedSlip[]; errors?: { file: string; message: string }[] };

/**
 * Pick or drop SPARK salary slip PDFs; the server reads them and the editor
 * fills the salary grid. `onRead` also gets the files that were read, so the
 * editor can attach them to the statement once it is saved.
 */
export default function SlipUpload({
  onRead,
}: {
  onRead: (slips: UploadedSlip[], files: File[]) => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<{ file: string; message: string }[]>([]);

  const upload = async (list: FileList | null) => {
    const files = [...(list ?? [])].filter((f) => f.size > 0);
    if (files.length === 0) return;
    const fd = new FormData();
    files.forEach((f) => fd.append("file", f));
    setBusy(true);
    const result = await apiRequest<SlipResponse>("/api/income-tax/slips", { method: "POST", body: fd });
    setBusy(false);
    setErrors(result.data?.errors ?? []);
    const slips = result.data?.slips ?? [];
    if (!result.success || slips.length === 0) {
      toast.error(result.message);
      return;
    }
    onRead(slips, slips.map((s) => files[s.index]).filter(Boolean));
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors sm:flex-row sm:text-left ${
          dragging ? "border-accent bg-accent-soft" : "border-line bg-elevated/50"
        }`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-fg">Generate from salary slips</div>
          <div className="text-xs text-muted">
            Drop the SPARK salary slip PDFs here (several at once). Each month is filled from its slip;
            months without one are projected from the nearest slip, ready to adjust.
          </div>
        </div>
        <Button type="button" size="sm" onClick={() => input.current?.click()} loading={busy}>
          <FileUp className="h-4 w-4" /> Upload slips
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-500 ring-1 ring-inset ring-amber-500/25">
          {errors.map((e) => (
            <li key={e.file} className="flex gap-1.5">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{e.file}</strong> — {e.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
