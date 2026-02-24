import { useEffect } from "react";
import { useLocation } from "wouter";
import type { UserPermission } from "@shared/schema";
import { usePermissions } from "@/hooks/use-permissions";

interface PermissionRedirectProps {
  permission: UserPermission;
  fallback: string;
  children: React.ReactNode;
}

/**
 * If the user doesn't have the given permission, redirect to fallback path.
 * Use for route-level guards (e.g. / requires view_dashboard, /jobs requires view_jobs).
 */
export function PermissionRedirect({ permission, fallback, children }: PermissionRedirectProps) {
  const [location, setLocation] = useLocation();
  const { hasPermission, isLoading } = usePermissions();

  useEffect(() => {
    if (isLoading) return;
    if (!hasPermission(permission)) {
      setLocation(fallback);
    }
  }, [hasPermission, permission, fallback, isLoading, setLocation]);

  if (isLoading) return null;
  if (!hasPermission(permission)) return null;
  return <>{children}</>;
}
