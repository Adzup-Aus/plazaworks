import type { RequestHandler } from "express";
import { getUserId as getUserIdFromAuth, requireUserId as requireUserIdFromAuth } from "../auth-utils";
import { storage } from "../storage";

export { getUserIdFromAuth as getUserId, requireUserIdFromAuth as requireUserId };

/** No-op: feature gating removed (single-tenant). All features allowed. */
export const requireFeature = (_feature: string): RequestHandler => {
  return (req, res, next) => next();
};

/** No-op: user limits removed (single-tenant). */
export const checkUserLimit: RequestHandler = (req, res, next) => next();

/** No-op: job limits removed (single-tenant). */
export const checkJobLimit: RequestHandler = (req, res, next) => next();

/** No-op: organization context removed (single-tenant). */
export const withOrganization: RequestHandler = (req, res, next) => next();

/** Admin check: user must have staff profile with admin role or admin_settings permission. */
export const requireSuperAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const profile = await storage.getStaffProfileByUserId(userId);
    const isAdmin =
      profile &&
      (profile.roles?.includes("admin") || profile.permissions?.includes("admin_settings"));

    if (!isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.isSuperAdmin = true;
    next();
  } catch (err) {
    console.error("Error checking admin access:", err);
    res.status(500).json({ message: "Failed to verify admin access" });
  }
};

export const ensureStaffProfile: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (userId) {
      const existingProfile = await storage.getStaffProfileByUserId(userId);
      if (!existingProfile) {
        await storage.createStaffProfile({
          userId,
          roles: ["plumber"],
          employmentType: "permanent",
          permissions: [],
          isActive: true,
        });
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};
