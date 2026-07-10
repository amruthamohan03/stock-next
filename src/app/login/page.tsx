import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">
            S
          </div>
          <h1 className="text-xl font-semibold text-slate-800">
            Stock Management
          </h1>
          <p className="text-sm text-slate-500">
            Government Polytechnic College Nedumkandam
          </p>
        </div>
        <LoginForm />
        <p className="mt-4 text-center text-xs text-slate-400">
          Next.js + PostgreSQL edition
        </p>
      </div>
    </div>
  );
}
