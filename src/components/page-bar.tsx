"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MenuNode } from "@/lib/rbac";
import { toRoute } from "@/lib/menu-map";

/**
 * Pages visited in this tab since the app loaded. A reload or a link opened in
 * a new tab starts at 1, where "back" has nowhere in-app to go.
 */
let visits = 0;

const isId = (seg: string) => /^\d+$/.test(seg);

/**
 * Where Back goes without history: up one level of the URL (an edit page to
 * its record, a record to its list), else the dashboard.
 * /indent/12/edit → /indent/12 · /indent/12 → /indent · /event/5/item/9 → /event/5
 */
export function parentRoute(pathname: string): string {
  const segs = pathname.split("/").filter(Boolean);
  const last = segs.pop();
  if (!last || segs.length === 0) return "/dashboard";
  // Leaving a record: a list sits above it, unless the segment above is itself
  // a sub-list of another record (/event/5/item) — then go to that record.
  if (isId(last)) {
    if (segs.length >= 2 && isId(segs[segs.length - 2])) segs.pop();
    return `/${segs.join("/")}`;
  }
  // A sub-page of a record (/indent/12/edit, /event/5/duty).
  if (isId(segs[segs.length - 1])) return `/${segs.join("/")}`;
  return "/dashboard";
}

const words = (seg: string) =>
  seg === "edit" ? "Edit" : seg.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Breadcrumb labels for a path, named from the sidebar menu where possible. */
function crumbsFor(menu: MenuNode[], pathname: string) {
  let best: { route: string; trail: string[] } | null = null;
  const visit = (nodes: MenuNode[], parents: string[]) => {
    for (const n of nodes) {
      const route = toRoute(n.url);
      if (
        route !== "#" &&
        (pathname === route || pathname.startsWith(route + "/")) &&
        (!best || route.length > best.route.length)
      ) {
        best = { route, trail: [...parents, n.text ?? ""] };
      }
      visit(n.children, [...parents, n.text ?? ""]);
    }
  };
  visit(menu, []);
  const found = best as { route: string; trail: string[] } | null;
  if (!found) return pathname.split("/").filter(Boolean).filter((s) => !isId(s)).map(words);
  // Below the menu entry: a record is "Details", sub-pages are named.
  const rest = pathname.slice(found.route.length).split("/").filter(Boolean);
  const tail = rest.filter((s, i) => !(isId(s) && i < rest.length - 1)).map((s) => (isId(s) ? "Details" : words(s)));
  return [...found.trail, ...tail];
}

/**
 * Back button and breadcrumb at the top of every page in the protected shell,
 * so "back" sits in the same place everywhere. Hidden on the dashboard, which
 * is the root.
 */
export default function PageBar({ menu }: { menu: MenuNode[] }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    visits += 1;
  }, [pathname]);

  if (pathname === "/dashboard") return null;

  const back = () => {
    if (visits > 1) router.back();
    else router.push(parentRoute(pathname));
  };
  const crumbs = crumbsFor(menu, pathname);

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" onClick={back} title="Go back">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
        <Link
          href="/dashboard"
          className="flex items-center text-faint transition-colors hover:text-accent-fg"
          title="Dashboard"
        >
          <Home className="h-4 w-4" />
        </Link>
        {crumbs.map((c, i) => (
          <span key={`${c}-${i}`} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" />
            <span
              className={
                i === crumbs.length - 1 ? "truncate font-semibold text-fg" : "truncate text-muted"
              }
              aria-current={i === crumbs.length - 1 ? "page" : undefined}
            >
              {c}
            </span>
          </span>
        ))}
      </nav>
    </div>
  );
}
