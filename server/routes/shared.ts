export { storage } from "../storage";
export { isAuthenticated, authStorage } from "../replit_integrations/auth";
export {
  getUserId,
  requireUserId,
  requireSuperAdmin,
  ensureStaffProfile,
} from "../middleware";
export {
  checkPermission,
  getUserPermissions,
  isAdmin,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
} from "../middleware/permissions";
export {
  clientPortalAuth,
  createClientPortalToken,
  type ClientPortalRequest,
} from "../middleware/clientPortalAuth";
export { generateOTPCode } from "../lib/otp";
export { normalizePermissions } from "@shared/schema";
