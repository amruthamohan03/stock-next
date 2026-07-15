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
import { Card, CardContent } from "@/components/ui/card";

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
    { label: "Items", value: items, icon: Package, href: "/item", color: "bg-brand-500/15 text-brand-400" },
    { label: "Item Groups", value: groups, icon: Layers, href: "/item", color: "bg-violet-500/15 text-violet-400" },
    { label: "Indents", value: indents, icon: ClipboardList, href: "/indent", color: "bg-amber-500/15 text-amber-400" },
    { label: "Stock Transactions", value: transactions, icon: ArrowLeftRight, href: "/stock", color: "bg-emerald-500/15 text-emerald-400" },
    { label: "Stock Book Entries", value: stockBooks, icon: Boxes, href: "/stock", color: "bg-cyan-500/15 text-cyan-400" },
    { label: "Departments", value: departments, icon: Building2, href: "/department", color: "bg-rose-500/15 text-rose-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-fg">
          Welcome back, {session?.fullName ?? "User"}
        </h1>
        <p className="text-sm text-muted">
          Here&apos;s an overview of your inventory system.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="group">
            <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
              <CardContent className="flex items-center gap-4">
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.color} transition-transform group-hover:scale-105`}>
                  <c.icon className="h-6 w-6" />
                </span>
                <div>
                  <div className="text-2xl font-bold text-fg">{c.value}</div>
                  <div className="text-sm text-muted">{c.label}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
