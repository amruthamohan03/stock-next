"use client";

import { Building2, LogOut } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/session";
import ThemeToggle from "@/components/theme-toggle";

/** "Super Admin" → "SA", for the avatar. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export default function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-card/80 px-5 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-fg sm:flex">
          <Building2 className="h-[1.1rem] w-[1.1rem]" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-bold text-fg">
            Government Polytechnic College Nedumkandam
          </div>
          <div className="hidden truncate text-xs text-faint sm:block">Stock &amp; Inventory</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="flex items-center gap-2.5 rounded-full border border-line bg-elevated py-1 pl-1 pr-3 text-sm shadow-sm">
          <span className="bg-accent-duo flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-md shadow-accent/30">
            {initials(user.fullName)}
          </span>
          <div className="hidden leading-tight sm:block">
            <div className="font-semibold text-fg">{user.fullName}</div>
            <div className="text-xs text-faint">{user.roleName}</div>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-500"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </form>
      </div>
      {/* Thin accent strip along the bottom edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] bg-gradient-to-r from-accent via-accent-2 to-cyan-400 opacity-70"
      />
    </header>
  );
}
