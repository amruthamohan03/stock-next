"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, Trash2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Themed replacement for `window.confirm()`.
 *
 * The native dialog freezes the tab, cannot be styled, and shows the origin —
 * "localhost:3000 says" above a delete prompt reads like a browser warning
 * rather than part of the app.
 *
 * `useConfirm()` returns a function that resolves to true/false, so call sites
 * keep reading top-to-bottom:
 *
 *   if (!(await confirm({ title: "Delete this item?" }))) return;
 */

export type PromptOptions = {
  title: string;
  description?: string;
  /** Pre-filled value. */
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use a number input — the value still resolves as a string. */
  type?: "text" | "number";
};

export type ConfirmOptions = {
  title: string;
  description?: string;
  /** Label for the affirmative button. Defaults to "Confirm". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` styles the action red and shows a bin icon. */
  tone?: "danger" | "default";
};

type Pending =
  | (ConfirmOptions & { kind: "confirm"; resolve: (ok: boolean) => void })
  | (PromptOptions & { kind: "prompt"; resolve: (value: string | null) => void });

type DialogApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Themed replacement for window.prompt(). Resolves to null on cancel. */
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<DialogApi | null>(null);

function useDialogs(): DialogApi {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm/usePrompt must be used inside <ConfirmProvider> (mounted in the dashboard layout)");
  }
  return ctx;
}

export function useConfirm() {
  return useDialogs().confirm;
}

export function usePrompt() {
  return useDialogs().prompt;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [draft, setDraft] = useState("");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, kind: "confirm", resolve })),
    []
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setDraft(options.defaultValue ?? "");
        setPending({ ...options, kind: "prompt", resolve });
      }),
    []
  );

  /** Close the dialog, handing the caller's promise its answer. */
  const settle = useCallback((ok: boolean) => {
    setPending((p) => {
      if (p?.kind === "prompt") {
        // Read the draft at settle time via the functional update below.
        p.resolve(ok ? inputRef.current?.value ?? "" : null);
      } else {
        p?.resolve(ok);
      }
      return null;
    });
  }, []);

  const api = useMemo<DialogApi>(() => ({ confirm, prompt }), [confirm, prompt]);

  const isPrompt = pending?.kind === "prompt";
  const danger = pending?.kind === "confirm" && pending.tone === "danger";
  const Icon = isPrompt ? HelpCircle : danger ? Trash2 : AlertTriangle;
  const iconTone = isPrompt
    ? "bg-sky-500/15 text-sky-500"
    : danger
      ? "bg-red-500/15 text-red-500"
      : "bg-amber-500/15 text-amber-500";

  return (
    <ConfirmContext.Provider value={api}>
      {children}

      {pending && (
        <div
          className="no-print fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          // Escape cancels, matching the native dialog and the Modal component.
          onKeyDown={(e) => {
            if (e.key === "Escape") settle(false);
            // In a prompt, Enter submits rather than needing a click.
            if (e.key === "Enter" && isPrompt) {
              e.preventDefault();
              settle(true);
            }
          }}
          tabIndex={-1}
        >
          {/* Clicking the backdrop cancels; the panel below sits above it. */}
          <div className="absolute inset-0" onClick={() => settle(false)} />

          <div className="relative w-full max-w-md rounded-xl border border-line bg-card p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconTone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-title" className="text-sm font-semibold text-fg">
                  {pending.title}
                </h2>
                {pending.description && (
                  <p className="mt-1 text-sm text-muted">{pending.description}</p>
                )}
                {isPrompt && (
                  <Input
                    ref={inputRef}
                    // Focus on mount so the user can type straight away.
                    autoFocus
                    type={pending.type ?? "text"}
                    defaultValue={draft}
                    placeholder={pending.placeholder}
                    className="mt-3"
                  />
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => settle(false)}>
                {pending.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                ref={confirmRef}
                size="sm"
                // A confirm focuses its action button so Enter confirms; a
                // prompt leaves focus in the field instead.
                autoFocus={!isPrompt}
                onClick={() => settle(true)}
                className={danger ? "bg-red-500 text-white hover:bg-red-600" : undefined}
              >
                {pending.confirmLabel ?? (isPrompt ? "OK" : "Confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
