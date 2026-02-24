import type { UserPermission } from "@shared/schema";
import { userPermissions, normalizePermissions } from "@shared/schema";

export { userPermissions, normalizePermissions };
export type { UserPermission };

/** Map of nav item URL path (or key) to required permission. Used for filtering sidebar. */
export const NAV_PERMISSION_MAP: Record<string, UserPermission> = {
  "/": "view_dashboard",
  "/jobs": "view_jobs",
  "/quotes": "view_quotes",
  "/invoices": "view_invoices",
  "/schedule": "view_schedule",
  "/activities": "view_activities",
  "/team": "view_users",
  "/clients": "view_clients",
  "/settings": "admin_settings",
  "/kpi": "view_reports",
  "/productivity": "view_reports",
  "/capacity": "view_reports",
};

export type NavItemWithPermission = {
  title: string;
  url: string;
  icon: unknown;
  permission?: UserPermission;
};

/**
 * Filter navigation items to those the user is allowed to see.
 * Admin sees all. Otherwise only items whose permission is in the user's list are shown.
 * Dashboard (/) is shown only if user has view_dashboard OR is admin.
 */
export function filterNavByPermissions<T extends { url: string; permission?: UserPermission }>(
  items: T[],
  permissions: string[],
  isAdmin: boolean
): T[] {
  if (isAdmin) return items;
  const permSet = new Set(permissions);
  return items.filter((item) => {
    const required = item.permission ?? NAV_PERMISSION_MAP[item.url];
    if (!required) return true;
    if (item.url === "/") return permSet.has("view_dashboard");
    return permSet.has(required);
  });
}

/** Order of paths to try when redirecting user without dashboard access. */
const FIRST_PATH_ORDER = ["/jobs", "/quotes", "/invoices", "/schedule", "/activities", "/team", "/clients", "/", "/kpi", "/productivity", "/capacity", "/settings"];

/** Return first path the user is allowed to access (for redirect when no dashboard). */
export function getFirstAuthorizedPath(permissions: string[], isAdmin: boolean): string {
  if (isAdmin) return "/";
  const permSet = new Set(permissions);
  for (const path of FIRST_PATH_ORDER) {
    const required = NAV_PERMISSION_MAP[path];
    if (!required) return path;
    if (path === "/" && permSet.has("view_dashboard")) return "/";
    if (path !== "/" && permSet.has(required)) return path;
  }
  return "/no-access";
}
