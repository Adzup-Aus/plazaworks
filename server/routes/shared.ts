export { storage } from "../storage";
export { isAuthenticated, authStorage } from "../replit_integrations/auth";
export {
  getUserId,
  requireUserId,
  requireFeature,
  checkUserLimit,
  checkJobLimit,
  withOrganization,
  requireSuperAdmin,
  ensureStaffProfile,
} from "../middleware";
export {
  clientPortalAuth,
  createClientPortalToken,
  type ClientPortalRequest,
} from "../middleware/clientPortalAuth";
export { generateOTPCode } from "../lib/otp";
