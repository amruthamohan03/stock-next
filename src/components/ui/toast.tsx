"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";

/**
 * App-wide toasts — the one way to tell the user a write succeeded or failed.
 *
 * Replaces `alert()` (which blocks the tab, is unstyled, and cannot show two
 * things at once) and the per-page `msg` banners that each page re-implemented.
 *
 * Mounted once in the dashboard layout; reach it with `useToast()`.
 */

export type ToastTone = "success" | "error" | "info" | "warning";

type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
};

type ToastInput = string | { title: string; description?: string; duration?: number };

type ToastApi = {
  success: (input: ToastInput) => void;
  error: (input: ToastInput) => void;
  info: (input: ToastInput) => void;
  warning: (input: ToastInput) => void;
  /** Show an ApiResult's message with the right tone in one call. */
  fromResult: (
    result: { success: boolean; message: string },
    fallback?: { success?: string; error?: string }
  ) => boolean;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Errors stay longer — the user may need to read and act on them. */
const DURATION: Record<ToastTone, number> = {
  success: 3500,
  info: 4000,
  warning: 6000,
  error: 7000,
};

const TONES: Record<ToastTone, { icon: typeof CheckCircle2; ring: string; accent: string }> = {
  success: {
    icon: CheckCircle2,
    ring: "ring-emerald-500/30",
    accent: "text-emerald-500 bg-emerald-500/15",
  },
  error: { icon: AlertCircle, ring: "ring-red-500/30", accent: "text-red-500 bg-red-500/15" },
  warning: {
    icon: AlertTriangle,
    ring: "ring-amber-500/30",
    accent: "text-amber-500 bg-amber-500/15",
  },
  info: { icon: Info, ring: "ring-sky-500/30", accent: "text-sky-500 bg-sky-500/15" },
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider> (mounted in the dashboard layout)");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone: ToastTone, input: ToastInput) => {
      const opts = typeof input === "string" ? { title: input } : input;
      if (!opts.title) return;
      const id = nextId.current++;
      setToasts((list) => {
        const next = [...list, { id, tone, title: opts.title, description: opts.description }];
        // Keep the stack readable — drop the oldest beyond four.
        return next.slice(-4);
      });
      const ms = ("duration" in opts && opts.duration) || DURATION[tone];
      timers.current.set(id, window.setTimeout(() => dismiss(id), ms));
    },
    [dismiss]
  );

  // Clear pending timers if the provider unmounts mid-flight.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending.values()) window.clearTimeout(t);
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (i) => push("success", i),
      error: (i) => push("error", i),
      info: (i) => push("info", i),
      warning: (i) => push("warning", i),
      fromResult: (result, fallback) => {
        if (result.success) {
          const text = result.message || fallback?.success;
          if (text) push("success", text);
        } else {
          push("error", result.message || fallback?.error || "Something went wrong.");
        }
        return result.success;
      },
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      // `pointer-events-none` on the stack so it never blocks the page; each
      // toast re-enables them for itself.
      className="no-print pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const { icon: Icon, ring, accent } = TONES[t.tone];
        return (
          <div
            key={t.id}
            // An error interrupts the screen reader; the rest wait their turn.
            role={t.tone === "error" ? "alert" : "status"}
            aria-live={t.tone === "error" ? "assertive" : "polite"}
            className={`toast-in pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-card p-3 shadow-lg ring-1 ${ring}`}
          >
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${accent}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-elevated hover:text-fg"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(0.5rem) scale(0.98); }
          to   { opacity: 1; transform: none; }
        }
        .toast-in { animation: toast-in 160ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .toast-in { animation: none; } }
      `}</style>
    </div>
  );
}
