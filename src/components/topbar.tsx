"use client";

import { LogOut, User } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/session";

export default function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/85 px-5 backdrop-blur-md">
      <div className="text-sm font-medium text-slate-600">
        Government Polytechnic College Nedumkandam
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-sm shadow-sm">
          <span className="bg-brand-grad flex h-7 w-7 items-center justify-center rounded-full text-white">
            <User className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="font-medium text-slate-800">{user.fullName}</div>
            <div className="text-xs text-slate-400">{user.roleName}</div>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </form>
      </div>
    </header>
  );
}
