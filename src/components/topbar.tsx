"use client";

import { LogOut, User } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/session";
import ThemeToggle from "@/components/theme-toggle";

export default function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-card/85 px-5 backdrop-blur-md">
      <div className="truncate text-sm font-medium text-muted">
        Government Polytechnic College Nedumkandam
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="flex items-center gap-2.5 rounded-full border border-line bg-elevated py-1 pl-1 pr-3 text-sm shadow-sm">
          <span className="bg-brand-grad flex h-7 w-7 items-center justify-center rounded-full text-white">
            <User className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="font-medium text-fg">{user.fullName}</div>
            <div className="text-xs text-faint">{user.roleName}</div>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </form>
      </div>
    </header>
  );
}
