import type { UserPermission } from "@shared/schema";
import { usePermissions } from "@/hooks/use-permissions";

interface PermissionGateProps {
  permission?: UserPermission;
  permissions?: UserPermission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children only when the current user has the required permission(s).
 * Use for hiding Create/Edit/Delete buttons and other action UI.
 */
export function PermissionGate({ permission, permissions: permList, requireAll, fallback = null, children }: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let allowed = true;
  if (permission) {
    allowed = hasPermission(permission);
  } else if (permList && permList.length > 0) {
    allowed = requireAll ? hasAllPermissions(...permList) : hasAnyPermission(...permList);
  }

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
