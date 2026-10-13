"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete, apiRequest } from "@/lib/api-client";

/**
 * A single branding image (logo or favicon).
 *
 * Stored as an attachment row like every other upload — same route, same
 * storage, same byte-sniffing — but presented as one replaceable slot rather
 * than the multi-file panel, because there is only ever one of each. Uploading
 * a replacement removes the previous one so the store does not grow.
 */
export default function BrandAsset({
  label,
  hint,
  category,
  settingsId,
  currentId,
  accept,
  square,
}: {
  label: string;
  hint: string;
  category: "LOGO" | "FAVICON";
  settingsId: number;
  currentId: number | null;
  accept: string;
  /** Favicons preview in a small square; the logo gets a wider box. */
  square?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Bust the browser cache after a replace, so the preview is not stale.
  const [ver, setVer] = useState(0);

  const src = currentId ? `/api/attachment?id=${currentId}&v=${ver}` : null;

  const upload = async (file: File) => {
    setBusy(true);
    const fd = new FormData();
    fd.append("owner_type", "SETTINGS");
    fd.append("owner_id", String(settingsId));
    fd.append("category", category);
    fd.append("file", file);
    const result = await apiRequest("/api/attachment", { method: "POST", body: fd });
    if (result.success && currentId) {
      // Only drop the old one once the new one is safely stored.
      await apiDelete(`/api/attachment?id=${currentId}`);
    }
    setBusy(false);
    if (toast.fromResult(result, { success: `${label} updated` })) {
      setVer((v) => v + 1);
      router.refresh();
    }
  };

  const remove = async () => {
    if (!currentId) return;
    const ok = await confirm({
      title: `Remove the ${label.toLowerCase()}?`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const result = await apiDelete(`/api/attachment?id=${currentId}`);
    setBusy(false);
    if (toast.fromResult(result, { success: `${label} removed` })) router.refresh();
  };

  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-fg">{label}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = ""; // allow re-picking the same file
        }}
        className="hidden"
      />
      <div className="flex items-center gap-2">
        <span
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-elevated ${
            square ? "h-11 w-11" : "h-11 w-20"
          }`}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] font-medium uppercase tracking-wide text-faint">None</span>
          )}
        </span>
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {currentId ? "Replace" : "Browse"}
        </Button>
        {currentId && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={busy}
            onClick={remove}
            className="text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-faint">
        <ImageIcon className="h-3 w-3" /> {hint}
      </p>
    </div>
  );
}
