"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { TableAction } from "@/components/ui/table-action";
import { formatDate } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { apiDelete, apiPost } from "@/lib/api-client";

export type DocumentRemark = {
  id: number;
  remark: string;
  remark_date: string | null;
  author: string | null;
};

const MAX_REMARK_LENGTH = 2000;

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * A document's dated remark trail — an append-only log, one row per remark.
 *
 * Each remark posts immediately (like the attachment), rather than riding along
 * with the document's Save, so a note is never lost by navigating away. When
 * the document is submitted the trail is frozen and this renders read-only.
 */
export default function DocumentRemarks({
  documentId,
  remarks,
  locked,
}: {
  documentId: number;
  remarks: DocumentRemark[];
  locked: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  // The rendered trail is held locally and updated the moment a write succeeds,
  // so a new remark appears whether or not router.refresh() lands. The server
  // stays the source of truth: when the page re-renders with fresh props, they
  // replace this list (and fill in the author name the server resolved).
  const [list, setList] = useState<DocumentRemark[]>(remarks);
  useEffect(() => setList(remarks), [remarks]);

  const [date, setDate] = useState(todayIso());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdd = !locked && !busy && text.trim().length > 0;

  const add = async () => {
    if (!canAdd) return;
    setError(null);
    setBusy(true);
    const result = await apiPost("/api/document/remark", {
      document_id: documentId,
      remark: text.trim().slice(0, MAX_REMARK_LENGTH),
      remark_date: date || null,
    });
    setBusy(false);
    if (result.success) {
      const id = (result.data as { id?: number } | undefined)?.id;
      setList((current) => [
        ...current,
        {
          id: id ?? -Date.now(), // placeholder until the refresh brings the real row
          remark: text.trim().slice(0, MAX_REMARK_LENGTH),
          remark_date: date || null,
          author: null,
        },
      ]);
      // Keep the date so several remarks entered in one sitting share it.
      setText("");
      toast.success("Remark added");
      router.refresh();
    } else {
      // Inline, not a toast — the error belongs beside the input being fixed.
      setError(result.message);
      toast.error(result.message);
    }
  };

  const remove = async (id: number) => {
    const ok = await confirm({
      title: "Remove this remark?",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setError(null);
    setBusy(true);
    const result = await apiDelete(`/api/document/remark?id=${id}`);
    setBusy(false);
    if (result.success) {
      setList((current) => current.filter((r) => r.id !== id));
      toast.success("Remark removed");
      router.refresh();
    } else {
      setError(result.message);
      toast.error(result.message);
    }
  };

  return (
    <div className="no-print space-y-3">
      {error && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-line">
        {list.length === 0 ? (
          <p className="px-3 py-2.5 text-sm text-muted">
            {locked ? "No remarks were added." : "No remarks yet. Add the first one below."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-muted">
                  {r.remark_date ? formatDate(r.remark_date) : "—"}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-fg">
                  {r.remark}
                </span>
                {r.author && <span className="shrink-0 text-xs text-faint">{r.author}</span>}
                {!locked && (
                  <TableAction
                    tone="delete"
                    icon={Trash2}
                    onClick={() => remove(r.id)}
                    title="Remove remark"
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {!locked && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line p-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
            <input
              value={text}
              maxLength={MAX_REMARK_LENGTH}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Enter adds the remark — a half-typed note must never trigger
                // the page's single Save.
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="Type a remark, then press + or Enter"
              className="min-w-0 flex-1 rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
            />
            <button
              type="button"
              onClick={add}
              disabled={!canAdd}
              title="Add remark"
              className="inline-flex h-9 w-11 items-center justify-center rounded-lg bg-accent text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
