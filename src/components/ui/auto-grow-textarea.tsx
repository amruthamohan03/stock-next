"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A textarea that grows its height to fit its content (and shrinks back),
 * so table rows expand to show the full text instead of scrolling inside a
 * fixed box. Works as a controlled input via `value`.
 */
export function AutoGrowTextarea({
  className,
  onInput,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px"; // reset so scrollHeight reflects the real content
    el.style.height = `${el.scrollHeight}px`;
  };

  // Re-fit when the controlled value changes (typing, prefill, reset).
  useEffect(resize, [props.value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      onInput={(e) => {
        resize();
        onInput?.(e);
      }}
      className={cn("resize-none overflow-hidden whitespace-pre-wrap", className)}
      {...props}
    />
  );
}
