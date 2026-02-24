import type { RequestHandler } from "express";
import type { UserPermission } from "@shared/schema";
import { userPermissions, normalizePermissions } from "@shared/schema";
import { getUserId } from "../auth-utils";
import { storage } from "../storage";

/** Check if staff profile has admin role. */
export function isAdmin(profile: { roles?: string[] | null } | null): boolean {
  return !!profile?.roles?.includes("admin");
}

/** Get effective permissions for a staff profile (admin gets all, else normalized explicit permissions). */
export function getEffectivePermissions(profile: { roles?: string[] | null; permissions?: string[] | null } | null): UserPermission[] {
  if (!profile) return [];
  if (isAdmin(profile)) return [...userPermissions];
  return normalizePermissions(profile.permissions ?? []);
}

/** Check if user has a specific permission. */
export async function checkPermission(userId: string, permission: UserPermission): Promise<boolean> {
  const profile = await storage.getStaffProfileByUserId(userId);
  const permissions = getEffectivePermissions(profile);
  return permissions.includes(permission);
}

/** Get effective permissions for a user. */
export async function getUserPermissions(userId: string): Promise<UserPermission[]> {
  const profile = await storage.getStaffProfileByUserId(userId);
  return getEffectivePermissions(profile);
}

/** Middleware: require a single permission (admin bypasses). */
export function requirePermission(permission: UserPermission): RequestHandler {
  return async (req: any, res, next) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const profile = await storage.getStaffProfileByUserId(userId);
      const permissions = getEffectivePermissions(profile);
      if (permissions.includes(permission)) {
        return next();
      }
      return res.status(403).json({ message: "You don't have permission to perform this action" });
    } catch (err) {
      console.error("Error checking permission:", err);
      return res.status(500).json({ message: "Failed to verify permission" });
    }
  };
}

/** Middleware: require any of the given permissions. */
export function requireAnyPermission(...permissions: UserPermission[]): RequestHandler {
  return async (req: any, res, next) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const profile = await storage.getStaffProfileByUserId(userId);
      const userPerms = getEffectivePermissions(profile);
      const hasAny = permissions.some((p) => userPerms.includes(p));
      if (hasAny) return next();
      return res.status(403).json({ message: "You don't have permission to perform this action" });
    } catch (err) {
      console.error("Error checking permission:", err);
      return res.status(500).json({ message: "Failed to verify permission" });
    }
  };
}

/** Middleware: require all of the given permissions. */
export function requireAllPermissions(...permissions: UserPermission[]): RequestHandler {
  return async (req: any, res, next) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const profile = await storage.getStaffProfileByUserId(userId);
      const userPerms = getEffectivePermissions(profile);
      const hasAll = permissions.every((p) => userPerms.includes(p));
      if (hasAll) return next();
      return res.status(403).json({ message: "You don't have permission to perform this action" });
    } catch (err) {
      console.error("Error checking permission:", err);
      return res.status(500).json({ message: "Failed to verify permission" });
    }
  };
}
