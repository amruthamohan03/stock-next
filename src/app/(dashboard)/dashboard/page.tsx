import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import Link from "next/link";
import {
  Boxes,
  ClipboardList,
  ArrowLeftRight,
  Building2,
  Package,
  Layers,
} from "lucide-react";
import { db } from "@/db";
import {
  itemMasterT,
  indentMasterT,
  stockTransactionT,
  departmentMasterT,
  stockBookT,
  groupItemNameMasterT,
} from "@/db/schema";
import { getSession } from "@/lib/session";

async function count(table: PgTable) {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(table);
  return rows[0]?.n ?? 0;
}

export default async function DashboardPage() {
  const session = await getSession();

  const [items, indents, transactions, departments, stockBooks, groups] =
    await Promise.all([
      count(itemMasterT),
      count(indentMasterT),
      count(stockTransactionT),
      count(departmentMasterT),
      count(stockBookT),
      count(groupItemNameMasterT),
    ]);

  const cards = [
    { label: "Items", value: items, icon: Package, href: "/item", grad: "grad-blue" },
    { label: "Item Groups", value: groups, icon: Layers, href: "/item", grad: "grad-violet" },
    { label: "Indents", value: indents, icon: ClipboardList, href: "/indent", grad: "grad-amber" },
    { label: "Stock Transactions", value: transactions, icon: ArrowLeftRight, href: "/stock", grad: "grad-green" },
    { label: "Stock Book Entries", value: stockBooks, icon: Boxes, href: "/stock", grad: "grad-cyan" },
    { label: "Departments", value: departments, icon: Building2, href: "/department", grad: "grad-rose" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-accent-duo relative overflow-hidden rounded-2xl px-6 py-6 text-white shadow-lg shadow-accent/20">
        {/* Soft rings for depth; purely decorative. */}
        <span className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/10" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
          Dashboard
        </p>
        <h1 className="relative mt-1 text-2xl font-extrabold tracking-tight">
          Welcome back, {session?.fullName ?? "User"} 👋
        </h1>
        <p className="relative mt-1 text-sm text-white/80">
          Here&apos;s an overview of your inventory system.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${c.grad}`}
          >
            <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/15 transition-transform duration-300 group-hover:scale-125" />
            <span className="pointer-events-none absolute -bottom-12 right-10 h-24 w-24 rounded-full bg-white/10" />
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30 backdrop-blur-sm transition-transform group-hover:scale-110">
              <c.icon className="h-6 w-6" />
            </span>
            <div className="relative">
              <div className="text-3xl font-extrabold tracking-tight tabular-nums">{c.value}</div>
              <div className="text-sm font-medium text-white/85">{c.label}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
