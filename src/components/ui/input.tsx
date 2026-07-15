import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-fg shadow-sm transition-colors placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 w-full rounded-lg border border-line bg-elevated px-2 text-sm text-fg shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export const Label = ({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={cn("mb-1 block text-sm font-medium text-fg", className)}
    {...props}
  />
);
