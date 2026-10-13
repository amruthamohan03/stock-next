"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Boxes,
  LayoutDashboard,
  Package,
  LayoutGrid,
  FileText,
  Users,
  Settings,
  BarChart3,
  ClipboardList,
  Truck,
  Boxes as BoxesIcon,
  BookOpen,
  Folder,
  MessageSquare,
  CalendarDays,
  Award,
  type LucideIcon,
} from "lucide-react";
import type { MenuNode } from "@/lib/rbac";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/app-settings";
import { toRoute, IMPLEMENTED } from "@/lib/menu-map";
import { cn } from "@/lib/utils";

/**
 * Resolve a menu node to a lucide icon. The DB stores Tabler classes
 * (e.g. "ti ti-package") which this app can't render, so we map the icon
 * suffix (and fall back to keywords in the label) to a lucide icon.
 */
function iconFor(node: MenuNode): LucideIcon {
  const raw = (node.icon ?? "").toLowerCase();
  const text = (node.text ?? "").toLowerCase();
  const key = raw.replace(/^.*\bti-?/, "").trim(); // "ti ti-package" → "package"

  const byClass: Record<string, LucideIcon> = {
    dashboard: LayoutDashboard,
    home: LayoutDashboard,
    package: Package,
    "package-variant": Package,
    box: BoxesIcon,
    layout: LayoutGrid,
    "layout-2": LayoutGrid,
    report: BarChart3,
    reports: BarChart3,
    chart: BarChart3,
    "chart-bar": BarChart3,
    file: FileText,
    "file-text": FileText,
    clipboard: ClipboardList,
    users: Users,
    user: Users,
    settings: Settings,
    truck: Truck,
    book: BookOpen,
    message: MessageSquare,
    mail: MessageSquare,
    "message-circle": MessageSquare,
    calendar: CalendarDays,
    "calendar-event": CalendarDays,
    "calendar-time": CalendarDays,
    "users-group": Users,
    confetti: Award,
    award: Award,
    trophy: Award,
  };
  if (byClass[key]) return byClass[key];

  // Fall back to keywords in the visible label.
  if (/dashboard|home/.test(text)) return LayoutDashboard;
  if (/stock|item|inventor/.test(text)) return Package;
  if (/master/.test(text)) return LayoutGrid;
  if (/report|book|register/.test(text)) return BarChart3;
  if (/user|role|menu|admin/.test(text)) return Users;
  if (/provider|supplier|vendor/.test(text)) return Truck;
  if (/setting|config/.test(text)) return Settings;
  if (/message|mail|whatsapp|send/.test(text)) return MessageSquare;
  if (/timetable|schedule|calendar|event|festival/.test(text)) return CalendarDays;
  if (/committee|arts|certificate|award/.test(text)) return Award;
  return Folder;
}

export default function AppSidebar({
  menu,
  settings = DEFAULT_SETTINGS,
}: {
  menu: MenuNode[];
  settings?: AppSettings;
}) {
  const pathname = usePathname();
  // Accordion: exactly one main menu is expanded at a time.
  const routeGroupId =
    menu.find(
      (n) => n.children.length > 0 && n.children.some((c) => pathname === toRoute(c.url))
    )?.id ?? null;
  const [openId, setOpenId] = useState<number | null>(routeGroupId);

  // Follow navigation — open the group that owns the current route.
  useEffect(() => {
    if (routeGroupId !== null) setOpenId(routeGroupId);
  }, [routeGroupId]);

  return (
    <aside
      className="hidden w-64 shrink-0 flex-col border-r border-line bg-card md:flex"
      // Blank settings leave these undefined, so the theme's own colours win.
      style={{
        background: "var(--sidebar-bg, var(--card))",
        color: "var(--sidebar-text, var(--fg))",
      }}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-5">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm",
            settings.logo_id ? "bg-elevated" : "bg-brand-grad text-white"
          )}
        >
          {settings.logo_id ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/attachment?id=${settings.logo_id}`}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <Boxes className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold">{settings.project_name}</div>
          {settings.tagline && (
            <div className="truncate text-[11px] opacity-60">{settings.tagline}</div>
          )}
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {menu.map((node) => (
          <MenuItem
            key={node.id}
            node={node}
            open={openId === node.id}
            onToggle={() => setOpenId((cur) => (cur === node.id ? null : node.id))}
          />
        ))}
      </nav>
    </aside>
  );
}

function MenuItem({
  node,
  open,
  onToggle,
}: {
  node: MenuNode;
  open: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const hasChildren = node.children.length > 0;
  const route = toRoute(node.url);
  const active = pathname === route;

  const Icon = iconFor(node);

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={onToggle}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-elevated hover:text-fg",
            open ? "bg-elevated text-fg" : "text-muted"
          )}
        >
          <span className="flex items-center gap-2.5">
            <Icon className="h-[1.15rem] w-[1.15rem] shrink-0 text-muted" />
            {node.text}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-faint transition-transform", open && "rotate-180")}
          />
        </button>
        {open && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-line pl-2">
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
  // Top-level leaves (e.g. Dashboard) are "main menus" → show their icon.
  const topLevel = node.level === 0;
  const Icon = iconFor(node);

  return (
    <Link
      href={route}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-accent-soft font-medium text-accent-fg"
          : "text-muted hover:bg-elevated hover:text-fg",
        !ready && !active && "text-faint"
      )}
      title={ready ? undefined : "Module not yet ported"}
    >
      {/* Icon only for main (top-level) menus; sub-menus show just the label. */}
      {topLevel && (
        <Icon
          className={cn(
            "h-[1.15rem] w-[1.15rem] shrink-0",
            active ? "text-accent-fg" : "text-muted group-hover:text-fg"
          )}
        />
      )}
      <span className="truncate">{node.text}</span>
    </Link>
  );
}
