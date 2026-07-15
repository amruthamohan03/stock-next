import { redirect } from "next/navigation";
import { Boxes, PackageCheck, ClipboardList, ArrowLeftRight } from "lucide-react";
import { getSession } from "@/lib/session";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4 sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(49,46,129,0.45)] ring-1 ring-slate-200/60 lg:grid-cols-2">
        {/* ---- Promo panel (hidden on small screens) ---- */}
        <div className="bg-brand-hero relative hidden flex-col justify-between overflow-hidden p-8 text-white lg:flex xl:p-10">
          {/* soft light blooms */}
          <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(500px_260px_at_15%_0%,#ffffff30,transparent),radial-gradient(500px_260px_at_100%_100%,#ffffff20,transparent)]" />

          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                <Boxes className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold tracking-tight">StockPro</span>
            </div>

            <h2 className="mt-8 font-serif text-3xl font-bold leading-tight xl:text-4xl">
              Stock Management.
            </h2>
            <p className="mt-2 max-w-xs text-sm text-brand-100/90">
              Track inventory, indents &amp; issues for your institution — all in one place.
            </p>
          </div>

          {/* ---- Decorative dashboard mockup on an orange glow ---- */}
          <div className="relative my-8 flex items-center justify-center">
            <div className="absolute h-52 w-52 rounded-full bg-orange-400/80 blur-2xl" />
            <div className="relative w-full max-w-xs rotate-[-3deg] rounded-2xl bg-white/95 p-4 text-slate-700 shadow-2xl ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">Indent Book</span>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                  128 indents
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { w: "w-24", c: "bg-emerald-100", t: "text-emerald-600", s: "RECEIVED" },
                  { w: "w-20", c: "bg-amber-100", t: "text-amber-600", s: "ISSUED" },
                  { w: "w-28", c: "bg-violet-100", t: "text-violet-600", s: "PASSED" },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2">
                    <div className="space-y-1">
                      <div className={`h-2 rounded-full bg-slate-200 ${r.w}`} />
                      <div className="h-1.5 w-12 rounded-full bg-slate-100" />
                    </div>
                    <span className={`rounded-full ${r.c} px-1.5 py-0.5 text-[8px] font-semibold ${r.t}`}>
                      {r.s}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <div className="h-10 flex-1 rounded-lg bg-brand-600" />
                <div className="h-10 flex-1 rounded-lg bg-orange-400" />
              </div>
            </div>
          </div>

          {/* ---- Feature chips ---- */}
          <div className="relative flex flex-wrap gap-2">
            {[
              { icon: PackageCheck, label: "Inventory" },
              { icon: ClipboardList, label: "Indents" },
              { icon: ArrowLeftRight, label: "Issues" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/15 backdrop-blur"
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </span>
            ))}
          </div>
        </div>

        {/* ---- Form panel ---- */}
        <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-12">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
