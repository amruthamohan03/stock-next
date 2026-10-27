import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "soft" | "ghost" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

/**
 * The app's only button.
 *
 * The look lives in globals.css under `.btn` (gradient, inner highlight,
 * coloured glow, hover lift) so links styled with buttonClasses() get exactly
 * the same treatment, and so the filled tones can be built from the accent
 * token — which means the colour chosen in Application Settings reaches every
 * primary button in the app.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn("btn", `btn-${variant}`, `btn-${size}`, className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks further clicks while a save is in flight. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
