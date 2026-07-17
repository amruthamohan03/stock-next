/**
 * Maps a legacy PHP menu URL (from menu_master_t.url) to a Next.js route.
 * Modules that have been ported point at real pages; the rest fall through
 * to the "coming soon" placeholder so the navigation stays complete.
 */
const DIRECT: Record<string, string> = {
  "home/index": "/dashboard",
  "item/index": "/item",
  "department/index": "/department",
  make: "/make",
  model: "/model",
  provider: "/provider",
  indent: "/indent",
  stock: "/stock",
  stockbooks: "/stockbooks",
  "stock/stockBooks": "/stockbooks",
  daybook: "/daybook",
  "user/index": "/user",
  "menu/index": "/menu",
  "role/index": "/role",
  dashboardCard: "/dashboard-card",
  rolemenumapping: "/role-menu-mapping",
  roleDashboardCard: "/role-dashboard-card-mapping",
  book: "/report/book",
  live: "/report/live",
  custom: "/report/custom",
  kfcform21: "/report/kfc-form-21",
  "report/kfc-form-21": "/report/kfc-form-21",
  message: "/message",
};

/** Routes that are actually implemented in this port. */
export const IMPLEMENTED = new Set<string>([
  "/dashboard",
  "/item",
  "/department",
  "/make",
  "/model",
  "/provider",
  "/unit",
  "/indent",
  "/stock",
  "/stockbooks",
  "/daybook",
  "/report/live",
  "/report/book",
  "/report/custom",
  "/report/kfc-form-21",
  "/message",
  "/menu",
  "/user",
  "/role",
  "/dashboard-card",
  "/role-menu-mapping",
  "/role-dashboard-card-mapping",
]);

export function toRoute(url: string | null): string {
  if (!url || url === "#") return "#";
  if (DIRECT[url]) return DIRECT[url];
  // strip a trailing /index and lead with a slash
  const slug = url.replace(/\/index$/, "");
  return "/" + slug.replace(/^\//, "");
}

export function isImplemented(url: string | null): boolean {
  return IMPLEMENTED.has(toRoute(url));
}
