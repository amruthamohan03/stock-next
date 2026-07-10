"use client";

import { LogOut, User } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/session";

export default function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="text-sm text-slate-500">
        Government Polytechnic College Nedumkandam
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
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
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </form>
      </div>
    </header>
  );
}
