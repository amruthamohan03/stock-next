import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "shadow-card overflow-hidden rounded-2xl border border-line bg-card",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-accent-soft/60 via-elevated/40 to-transparent px-5 py-4",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        // A short accent bar before every card title ties the panels together.
        "flex items-center gap-2.5 text-[15px] font-bold tracking-tight text-fg before:block before:h-4 before:w-1 before:shrink-0 before:rounded-full before:bg-gradient-to-b before:from-accent before:to-accent-2",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
