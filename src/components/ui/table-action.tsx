"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Colour tones for table row actions — soft tinted bg + coloured icon that
 *  works on both dark and light themes (opacity form, per the styling rules). */
export type ActionTone = "view" | "edit" | "delete" | "neutral";

const TONES: Record<ActionTone, string> = {
  view: "bg-sky-500/10 text-sky-500 hover:bg-sky-500/20",
  edit: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
  delete: "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20",
  neutral: "bg-slate-500/10 text-muted hover:bg-slate-500/20 hover:text-fg",
};

const BASE =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50";

type Common = {
  icon: LucideIcon;
  tone?: ActionTone;
  title: string;
  className?: string;
};

/**
 * A single coloured icon action for table rows (view / edit / delete …).
 * Renders a `<Link>` when `href` is given, otherwise a `<button>`.
 * Use this for EVERY row-action icon so their look stays consistent.
 */
export function TableAction(
  props: Common &
    (
      | { href: string; onClick?: never; disabled?: never }
      | { href?: never; onClick: () => void; disabled?: boolean }
    )
) {
  const { icon: Icon, tone = "neutral", title, className } = props;
  const classes = cn(BASE, TONES[tone], className);

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes} title={title} aria-label={title}>
        <Icon className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={classes}
      title={title}
      aria-label={title}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/** Flex wrapper to keep row-action icons aligned/spaced consistently. */
export function TableActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-1.5">{children}</div>;
}
