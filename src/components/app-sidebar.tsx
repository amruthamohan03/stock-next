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

/** True on a menu entry's page and on its sub-pages (/indent/12, /indent/12/edit). */
function isAt(pathname: string, url: string | null) {
  const route = toRoute(url);
  return route !== "#" && (pathname === route || pathname.startsWith(route + "/"));
}

/**
 * Each main menu gets its own colour, cycled in menu order, so the sidebar can
 * be scanned by colour as well as by label. Opacity tints read on dark and
 * light alike; `dot` marks that group's sub-menu items.
 */
const TONES = [
  { chip: "bg-indigo-500/15 text-indigo-500", dot: "bg-indigo-500" },
  { chip: "bg-emerald-500/15 text-emerald-500", dot: "bg-emerald-500" },
  { chip: "bg-amber-500/15 text-amber-500", dot: "bg-amber-500" },
  { chip: "bg-sky-500/15 text-sky-500", dot: "bg-sky-500" },
  { chip: "bg-rose-500/15 text-rose-500", dot: "bg-rose-500" },
  { chip: "bg-violet-500/15 text-violet-500", dot: "bg-violet-500" },
  { chip: "bg-cyan-500/15 text-cyan-500", dot: "bg-cyan-500" },
  { chip: "bg-orange-500/15 text-orange-500", dot: "bg-orange-500" },
  { chip: "bg-fuchsia-500/15 text-fuchsia-500", dot: "bg-fuchsia-500" },
  { chip: "bg-teal-500/15 text-teal-500", dot: "bg-teal-500" },
] as const;
type Tone = (typeof TONES)[number];

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
      (n) => n.children.length > 0 && n.children.some((c) => isAt(pathname, c.url))
    )?.id ?? null;
  const [openId, setOpenId] = useState<number | null>(routeGroupId);

  // Follow navigation — open the group that owns the current route.
  useEffect(() => {
    if (routeGroupId !== null) setOpenId(routeGroupId);
  }, [routeGroupId]);

  return (
    <aside
      className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line md:flex"
      // Blank settings leave these undefined, so the theme's own colours win.
      style={{
        background: "var(--sidebar-bg, var(--sidebar-grad))",
        color: "var(--sidebar-text, var(--fg))",
      }}
    >
      <div className="flex h-16 items-center gap-3 border-b border-line px-5">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-lg shadow-accent/25",
            settings.logo_id ? "bg-elevated" : "bg-accent-duo text-white"
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
          <div className="truncate text-[15px] font-extrabold tracking-tight">
            {settings.project_name}
          </div>
          {settings.tagline && (
            <div className="truncate text-[11px] font-medium opacity-60">{settings.tagline}</div>
          )}
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] opacity-45">
          Menu
        </p>
        {menu.map((node, i) => (
          <MenuItem
            key={node.id}
            node={node}
            tone={TONES[i % TONES.length]}
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
  tone,
  open,
  onToggle,
}: {
  node: MenuNode;
  tone: Tone;
  open: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const Icon = iconFor(node);

  if (node.children.length === 0) {
    return <Leaf node={node} tone={tone} active={isAt(pathname, node.url)} />;
  }

  const holdsActive = node.children.some((c) => isAt(pathname, c.url));
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "group flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold transition-colors",
          open || holdsActive ? "bg-elevated/80 text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg"
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <IconChip icon={Icon} className={tone.chip} />
          <span className="truncate">{node.text}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-faint transition-transform duration-200",
            open && "rotate-180 text-fg"
          )}
        />
      </button>
      <div className="nav-collapse" data-open={open}>
        <div>
          <div className="relative ml-[1.45rem] mt-1 space-y-0.5 border-l border-line py-0.5 pl-3">
            {node.children.map((child) => (
              <Leaf
                key={child.id}
                node={child}
                tone={tone}
                active={isAt(pathname, child.url)}
                tabIndex={open ? undefined : -1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function IconChip({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
        className
      )}
    >
      <Icon className="h-[1.05rem] w-[1.05rem]" />
    </span>
  );
}

function Leaf({
  node,
  tone,
  active,
  tabIndex,
}: {
  node: MenuNode;
  tone: Tone;
  active: boolean;
  /** -1 while the parent group is collapsed, so hidden links aren't tabbable. */
  tabIndex?: number;
}) {
  const route = toRoute(node.url);
  const ready = IMPLEMENTED.has(route);
  // Top-level leaves (e.g. Dashboard) are "main menus" → icon chip; sub-menus get a dot.
  const topLevel = node.level === 0;
  const Icon = iconFor(node);

  if (topLevel) {
    return (
      <Link
        href={route}
        tabIndex={tabIndex}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm font-semibold transition-all",
          active
            ? "bg-accent-duo text-white shadow-lg shadow-accent/30"
            : "text-muted hover:bg-elevated/60 hover:text-fg",
          !ready && !active && "opacity-60"
        )}
        title={ready ? undefined : "Module not yet ported"}
      >
        <IconChip icon={Icon} className={active ? "bg-white/20 text-white" : tone.chip} />
        <span className="truncate">{node.text}</span>
      </Link>
    );
  }

  return (
    <Link
      href={route}
      tabIndex={tabIndex}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-accent-soft font-semibold text-accent-fg"
          : "text-muted hover:bg-elevated/60 hover:text-fg",
        !ready && !active && "opacity-55"
      )}
      title={ready ? undefined : "Module not yet ported"}
    >
      {/* Sits on the group's rail line; grows and glows for the current page. */}
      <span
        className={cn(
          "absolute -left-[1.03rem] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full transition-all",
          active
            ? "h-2 w-2 bg-accent ring-4 ring-accent/20"
            : cn(tone.dot, "opacity-40 group-hover:opacity-90")
        )}
      />
      <span className="truncate">{node.text}</span>
    </Link>
  );
}
