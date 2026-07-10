"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Circle, Lock } from "lucide-react";
import type { MenuNode } from "@/lib/rbac";
import { toRoute, IMPLEMENTED } from "@/lib/menu-map";
import { cn } from "@/lib/utils";

export default function AppSidebar({ menu }: { menu: MenuNode[] }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-slate-100 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
          S
        </div>
        <span className="font-semibold text-slate-800">Stock</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {menu.map((node) => (
          <MenuItem key={node.id} node={node} />
        ))}
      </nav>
      <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
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
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <span>{node.text}</span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
        {open && (
          <div className="ml-3 mt-1 space-y-1 border-l border-slate-100 pl-3">
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
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-blue-50 font-medium text-blue-700"
          : "text-slate-600 hover:bg-slate-50",
        !ready && "text-slate-400"
      )}
      title={ready ? undefined : "Module not yet ported"}
    >
      {ready ? (
        <Circle className="h-2 w-2 fill-current" />
      ) : (
        <Lock className="h-3 w-3" />
      )}
      <span className="truncate">{node.text}</span>
    </Link>
  );
}
