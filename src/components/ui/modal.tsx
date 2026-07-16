"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const SIZES = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  "2xl": "max-w-5xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Width preset. Defaults to "lg". */
  size?: keyof typeof SIZES;
}) {
  // Drag offset from the centered position; reset each time the modal opens.
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onMove = useCallback((e: PointerEvent) => {
    if (!drag.current) return;
    setPos({
      x: drag.current.ox + (e.clientX - drag.current.sx),
      y: drag.current.oy + (e.clientY - drag.current.sy),
    });
  }, []);

  const onUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove]);

  const startDrag = (e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  useEffect(() => {
    if (open) setPos({ x: 0, y: 0 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [open, onClose, onMove, onUp]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`relative z-10 flex max-h-[90vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl`}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      >
        {/* Drag handle — grab the title bar to move the window. */}
        <div
          onPointerDown={startDrag}
          className="flex shrink-0 cursor-move select-none items-center justify-between border-b border-line bg-elevated px-5 py-4"
        >
          <h3 className="text-base font-semibold text-fg">{title}</h3>
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className="cursor-pointer rounded-md p-1 text-muted hover:bg-line hover:text-fg"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
