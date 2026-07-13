"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Circle, Lock, Boxes } from "lucide-react";
import type { MenuNode } from "@/lib/rbac";
import { toRoute, IMPLEMENTED } from "@/lib/menu-map";
import { cn } from "@/lib/utils";

export default function AppSidebar({ menu }: { menu: MenuNode[] }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-100 px-5">
        <div className="bg-brand-grad flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm">
          <Boxes className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-800">Stock</div>
          <div className="text-[11px] text-slate-400">Inventory System</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {menu.map((node) => (
          <MenuItem key={node.id} node={node} />
        ))}
      </nav>
      <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
        Next.js + PostgreSQL
      </div>
    </aside>
  );
}

function MenuItem({ node }: { node: MenuNode }) {
  const pathname = usePathname();
  const hasChildren = node.children.length > 0;
  const route = toRoute(node.url);
  const active = pathname === route;
  const [open, setOpen] = useState(
    hasChildren && node.children.some((c) => pathname === toRoute(c.url))
  );

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <span>{node.text}</span>
          <ChevronDown
            className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")}
          />
        </button>
        {open && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-100 pl-2">
            {node.children.map((child) => (
              <Leaf key={child.id} node={child} active={pathname === toRoute(child.url)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return <Leaf node={node} active={active} />;
}

function Leaf({ node, active }: { node: MenuNode; active: boolean }) {
  const route = toRoute(node.url);
  const ready = IMPLEMENTED.has(route);

  return (
    <Link
      href={route}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-brand-50 font-medium text-brand-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        !ready && !active && "text-slate-400"
      )}
      title={ready ? undefined : "Module not yet ported"}
    >
      {ready ? (
        <Circle
          className={cn(
            "h-2 w-2 shrink-0 transition-colors",
            active ? "fill-brand-600 text-brand-600" : "fill-slate-300 text-slate-300 group-hover:fill-slate-400"
          )}
        />
      ) : (
        <Lock className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate">{node.text}</span>
    </Link>
  );
}
