"use client";

import { useActionState, useState } from "react";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import { loginAction, type LoginState } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {}
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-2xl font-bold text-slate-900">Log in to StockPro.</h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Welcome back! Sign in with the credentials you were given during
        registration.
      </p>

      <form action={formAction} className="mt-7 space-y-4">
        {state.error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
            {state.error}
          </div>
        )}

        {/* Username */}
        <div>
          <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
            Username
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="username"
              name="username"
              autoComplete="username"
              placeholder="e.g. supadmin"
              className="pl-10"
              required
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="px-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:text-slate-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember me + forgot */}
        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer select-none items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              name="remember"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/40"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={() => setShowHint((v) => !v)}
            className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
          >
            Forgot your password?
          </button>
        </div>

        {showHint && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-100">
            Contact your system administrator to reset your password.
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "LOGIN"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        Government Polytechnic College Nedumkandam · Next.js + PostgreSQL edition
      </p>
    </div>
  );
}
