"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  ImageIcon,
  CloudUpload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TableAction } from "@/components/ui/table-action";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiDelete, apiRequest } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  CATEGORY_TINT,
  categoryOptions,
  formatBytes,
  isImageType,
  toCategory,
  type OwnerType,
} from "@/lib/attachment";

export type AttachmentRow = {
  id: number;
  category: string;
  title: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string | Date | null;
};

/**
 * Files attached to a committee or an event.
 *
 * One panel for both, used wherever paperwork hangs off a record: appointment
 * orders and minutes on a committee, photos and inter-poly documents on an
 * event. Several files can be dropped or picked at once.
 */
export default function AttachmentPanel({
  ownerType,
  ownerId,
  files,
  defaultCategory,
}: {
  ownerType: OwnerType;
  ownerId: number;
  files: AttachmentRow[];
  defaultCategory?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);

  const options = categoryOptions(ownerType);
  const [category, setCategory] = useState(defaultCategory ?? options[0].value);
  const [filter, setFilter] = useState<string>("ALL");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Only offer filters for categories that actually have files.
  const present = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of files) {
      const c = toCategory(f.category);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return counts;
  }, [files]);

  const shown = filter === "ALL" ? files : files.filter((f) => toCategory(f.category) === filter);

  const upload = async (list: FileList | File[]) => {
    const picked = Array.from(list);
    if (picked.length === 0) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("owner_type", ownerType);
    fd.append("owner_id", String(ownerId));
    fd.append("category", category);
    for (const f of picked) fd.append("file", f);
    const result = await apiRequest("/api/attachment", { method: "POST", body: fd });
    setBusy(false);
    // The route reports partial success precisely, so show its message as-is.
    if (toast.fromResult(result)) router.refresh();
  };

  const remove = async (f: AttachmentRow) => {
    const ok = await confirm({
      title: `Remove ${f.file_name ?? "this file"}?`,
      description: "The file is deleted from the server.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    const result = await apiDelete(`/api/attachment?id=${f.id}`);
    if (toast.fromResult(result, { success: "File removed" })) router.refresh();
  };

  return (
    <div className="@container space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        onChange={(e) => {
          if (e.target.files) upload(e.target.files);
          e.target.value = ""; // allow re-picking the same files
        }}
        className="hidden"
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <SearchableSelect value={category} onChange={setCategory} options={options} />
        </div>
        <Button size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? "Uploading…" : "Choose files"}
        </Button>
      </div>

      {/* Drop zone — the whole area accepts a multi-file drop. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
        }}
        className={`rounded-xl border border-dashed px-4 py-6 text-center text-sm transition-colors ${
          dragging
            ? "border-accent bg-accent-soft text-fg"
            : "border-line bg-elevated/40 text-muted"
        }`}
      >
        <CloudUpload className="mx-auto mb-1.5 h-6 w-6" />
        <div className="font-medium">
          Drop files here, as <span className="text-accent">{CATEGORY_LABEL[toCategory(category)]}</span>
        </div>
        <div className="text-xs text-faint">Images or PDF, up to 10 MB each — several at once is fine</div>
      </div>

      {files.length > 0 && (
        <>
          {/* Category filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                filter === "ALL"
                  ? "bg-accent text-accent-fg ring-transparent"
                  : "bg-elevated text-muted ring-line hover:text-fg"
              }`}
            >
              All {files.length}
            </button>
            {[...present.entries()].map(([c, n]) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                  filter === c
                    ? "bg-accent text-accent-fg ring-transparent"
                    : `${CATEGORY_TINT[toCategory(c)]} hover:opacity-80`
                }`}
              >
                {CATEGORY_LABEL[toCategory(c)]} {n}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 @md:grid-cols-2 @4xl:grid-cols-3">
            {shown.map((f) => {
              const src = `/api/attachment?id=${f.id}`;
              const image = isImageType(f.file_type);
              return (
                <div
                  key={f.id}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-card p-2.5 transition-colors hover:border-accent/40"
                >
                  <a
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                    title="Open"
                  >
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={f.file_name ?? "Attachment"}
                        className="h-12 w-12 rounded-lg border border-line object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-elevated text-accent">
                        <FileText className="h-5 w-5" />
                      </span>
                    )}
                  </a>

                  <div className="min-w-0 flex-1">
                    <a
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium text-fg hover:text-accent hover:underline"
                      title={f.file_name ?? ""}
                    >
                      {f.title || f.file_name || "Untitled"}
                    </a>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] text-muted">
                      <span
                        className={`whitespace-nowrap rounded-full px-1.5 py-0.5 ring-1 ring-inset ${CATEGORY_TINT[toCategory(f.category)]}`}
                      >
                        {CATEGORY_LABEL[toCategory(f.category)]}
                      </span>
                      {f.file_size ? (
                        <span className="whitespace-nowrap">{formatBytes(f.file_size)}</span>
                      ) : null}
                      {f.created_at ? (
                        <span className="whitespace-nowrap">{formatDate(f.created_at)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                    <TableAction tone="delete" icon={Trash2} onClick={() => remove(f)} title="Remove" />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {files.length === 0 && (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <ImageIcon className="h-4 w-4" /> No files yet.
        </p>
      )}
    </div>
  );
}
