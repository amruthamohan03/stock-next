"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, Undo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { apiPatch } from "@/lib/api-client";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  isLocked,
  nextActionLabel,
  nextStatus,
  prevStatus,
  statusLabel,
  toDocStatus,
} from "@/lib/document-status";

/**
 * The workflow control shown above the document sheet: the current status, the
 * button that advances it, and — once submitted — the lock notice.
 *
 * Advancing to SUBMITTED is the "make final" action: the API refuses every
 * further edit, so the confirm here is the last chance to back out.
 */
export default function DocumentStatus({
  documentId,
  status,
  isSuperAdmin,
}: {
  documentId: number;
  status: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  const current = toDocStatus(status);
  const next = nextStatus(current);
  const back = prevStatus(current);
  const locked = isLocked(current);

  const move = async (to: string, ask?: { title: string; description?: string }) => {
    if (ask && !(await confirm({ ...ask, confirmLabel: "Continue" }))) return;
    setBusy(true);
    const result = await apiPatch("/api/document", { id: documentId, status: to });
    setBusy(false);
    if (toast.fromResult(result, { error: "Could not change the status" })) router.refresh();
  };

  // Once locked, only a Super Admin sees a way back.
  const canReopen = locked ? isSuperAdmin : !!back;

  return (
    <div className="no-print space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Status</span>
        <StatusBadge status={current} label={statusLabel(current)} />

        {locked && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Lock className="h-3.5 w-3.5" />
            Final — this document can no longer be edited
          </span>
        )}

        <span className="flex-1" />

        {canReopen && back && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              move(
                back,
                locked
                  ? {
                      title: "Reopen this document?",
                      description:
                        "It will return to Verified and become editable again.",
                    }
                  : undefined
              )
            }
          >
            <Undo2 className="h-4 w-4" />
            {locked ? "Reopen" : `Back to ${statusLabel(back)}`}
          </Button>
        )}

        {next && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              move(
                next,
                next === "SUBMITTED"
                  ? {
                      title: "Submit this document?",
                      description:
                        "Once submitted it is final and cannot be edited.",
                    }
                  : undefined
              )
            }
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {nextActionLabel(current)}
          </Button>
        )}
      </div>

    </div>
  );
}
