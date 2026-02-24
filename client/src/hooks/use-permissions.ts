import { useMemo } from "react";
import type { UserPermission } from "@shared/schema";
import { userPermissions } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { normalizePermissions } from "@/lib/permissions";

type PermissionResource =
  | "dashboard"
  | "jobs"
  | "quotes"
  | "invoices"
  | "schedule"
  | "activities"
  | "users"
  | "clients"
  | "reports"
  | "settings";

const RESOURCE_VIEW: Record<PermissionResource, UserPermission> = {
  dashboard: "view_dashboard",
  jobs: "view_jobs",
  quotes: "view_quotes",
  invoices: "view_invoices",
  schedule: "view_schedule",
  activities: "view_activities",
  users: "view_users",
  clients: "view_clients",
  reports: "view_reports",
  settings: "admin_settings",
};
const RESOURCE_CREATE: Partial<Record<PermissionResource, UserPermission>> = {
  jobs: "create_jobs",
  quotes: "create_quotes",
  invoices: "create_invoices",
  users: "create_users",
  clients: "create_clients",
};
const RESOURCE_EDIT: Partial<Record<PermissionResource, UserPermission>> = {
  jobs: "edit_jobs",
  quotes: "edit_quotes",
  invoices: "edit_invoices",
  users: "edit_users",
  clients: "edit_clients",
};
const RESOURCE_DELETE: Partial<Record<PermissionResource, UserPermission>> = {
  jobs: "delete_jobs",
  quotes: "delete_quotes",
  invoices: "delete_invoices",
  users: "delete_users",
  clients: "delete_clients",
};

export function usePermissions() {
  const { user, isLoading } = useAuth();

  const { permissions, isAdmin, hasPermission, hasAnyPermission, hasAllPermissions, canView, canCreate, canEdit, canDelete } =
    useMemo(() => {
      const rawPermissions = (user?.permissions ?? []) as string[];
      const isAdminUser = !!user?.role && (user.role === "admin" || rawPermissions.includes("admin_settings"));
      const perms = isAdminUser ? [...userPermissions] : normalizePermissions(rawPermissions);
      const permSet = new Set(perms);

      return {
        permissions: perms,
        isAdmin: isAdminUser,
        hasPermission: (p: UserPermission) => permSet.has(p),
        hasAnyPermission: (...p: UserPermission[]) => p.some((x) => permSet.has(x)),
        hasAllPermissions: (...p: UserPermission[]) => p.every((x) => permSet.has(x)),
        canView: (r: PermissionResource) => permSet.has(RESOURCE_VIEW[r]),
        canCreate: (r: PermissionResource) => (RESOURCE_CREATE[r] ? permSet.has(RESOURCE_CREATE[r]!) : false),
        canEdit: (r: PermissionResource) => (RESOURCE_EDIT[r] ? permSet.has(RESOURCE_EDIT[r]!) : false),
        canDelete: (r: PermissionResource) => (RESOURCE_DELETE[r] ? permSet.has(RESOURCE_DELETE[r]!) : false),
      };
    }, [user?.permissions, user?.role]);

  return {
    permissions,
    isLoading,
    isAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canView,
    canCreate,
    canEdit,
    canDelete,
  };
}
