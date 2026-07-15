import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-700",
  secondary: "bg-elevated text-fg hover:bg-line",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  ghost: "text-muted hover:bg-elevated hover:text-fg",
  outline: "border border-line bg-card text-fg shadow-sm hover:bg-elevated",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  icon: "h-8 w-8",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50";

/** Button styling as a class string — reuse on links/anchors that should look
 *  like a button (avoids duplicating the class list). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  )
);
Button.displayName = "Button";
