import { redirect } from "next/navigation";
import { Boxes } from "lucide-react";
import { getSession } from "@/lib/session";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Brand backdrop */}
      <div className="bg-brand-hero absolute inset-0 -z-10" />
      <div className="absolute inset-0 -z-10 opacity-30 [background:radial-gradient(600px_300px_at_20%_10%,#fff2,transparent),radial-gradient(600px_300px_at_90%_90%,#fff2,transparent)]" />

      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white shadow-lg ring-1 ring-white/25 backdrop-blur">
            <Boxes className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">Stock Management</h1>
          <p className="text-sm text-white/70">
            Government Polytechnic College Nedumkandam
          </p>
        </div>
        <LoginForm />
        <p className="mt-4 text-center text-xs text-white/50">
          Next.js + PostgreSQL edition
        </p>
      </div>
    </div>
  );
}
