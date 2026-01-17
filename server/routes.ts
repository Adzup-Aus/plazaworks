import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { createHmac, randomBytes } from "crypto";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";

// Client portal session token utilities
// Require SESSION_SECRET in production; allow fallback only in development
const CLIENT_PORTAL_SECRET = process.env.SESSION_SECRET;
if (!CLIENT_PORTAL_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET environment variable is required in production');
}
const PORTAL_SECRET = CLIENT_PORTAL_SECRET || 'dev-secret-not-for-production';
const TOKEN_EXPIRY_HOURS = 24 * 7; // 7 days

interface ClientPortalTokenPayload {
  sessionId: string; // Unique session ID for server-side validation
  clientId: string;
  portalAccountId: string;
  email: string;
  exp: number;
}

async function createClientPortalToken(
  payload: Omit<ClientPortalTokenPayload, 'exp' | 'sessionId'>,
  userAgent?: string,
  ipAddress?: string
): Promise<{ token: string; sessionId: string }> {
  const sessionId = randomBytes(32).toString('hex');
  const exp = Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  const expiresAt = new Date(exp);
  const data = JSON.stringify({ ...payload, sessionId, exp });
  const signature = createHmac('sha256', PORTAL_SECRET)
    .update(data)
    .digest('base64url');
  
  // Store session in database for validation and revocation
  await storage.createPortalSession(
    sessionId,
    payload.clientId,
    payload.portalAccountId,
    expiresAt,
    userAgent,
    ipAddress
  );
  
  return { token: Buffer.from(data).toString('base64url') + '.' + signature, sessionId };
}

function parseClientPortalToken(token: string): ClientPortalTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    
    const data = Buffer.from(parts[0], 'base64url').toString('utf8');
    const expectedSig = createHmac('sha256', PORTAL_SECRET)
      .update(data)
      .digest('base64url');
    
    if (parts[1] !== expectedSig) return null;
    
    const payload = JSON.parse(data) as ClientPortalTokenPayload;
    if (Date.now() > payload.exp) return null;
    
    return payload;
  } catch {
    return null;
  }
}

async function verifyClientPortalToken(token: string): Promise<ClientPortalTokenPayload | null> {
  const payload = parseClientPortalToken(token);
  if (!payload) return null;
  
  // Verify session exists in database and is not revoked
  const session = await storage.getPortalSession(payload.sessionId);
  if (!session) return null;
  if (session.revokedAt) return null;
  if (new Date() > session.expiresAt) return null;
  
  return payload;
}

interface ClientPortalRequest extends Request {
  clientPortal?: ClientPortalTokenPayload;
}

async function clientPortalAuth(req: ClientPortalRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Unauthorized - missing token" });
  }
  
  const token = authHeader.substring(7);
  const payload = await verifyClientPortalToken(token);
  
  if (!payload) {
    return res.status(401).json({ message: "Unauthorized - invalid or expired token" });
  }
  
  req.clientPortal = payload;
  next();
}
import { 
  insertJobSchema, 
  insertScheduleEntrySchema, 
  insertPCItemSchema,
  insertNotificationSchema,
  insertClientAccessTokenSchema,
  insertQuoteSchema,
  insertInvoiceSchema,
  insertLineItemSchema,
  insertPaymentSchema,
  insertVehicleSchema,
  insertVehicleAssignmentSchema,
  insertChecklistTemplateSchema,
  insertChecklistTemplateItemSchema,
  insertChecklistRunSchema,
  insertChecklistRunItemSchema,
  insertJobPhotoSchema,
  insertJobReceiptSchema,
  insertVehicleMaintenanceSchema,
  insertJobTimeEntrySchema,
  insertJobCostEntrySchema,
  insertStaffCapacityRuleSchema,
  insertStaffTimeOffSchema,
  insertClientSchema,
  insertTermsTemplateSchema,
  insertJobMilestoneSchema,
  insertMilestonePaymentSchema,
  insertMilestoneMediaSchema,
  clientTypes,
  milestoneStatuses,
  milestonePaymentStatuses,
  userRoles, 
  employmentTypes, 
  userPermissions,
  pcItemStatuses,
  notificationTypes,
  quoteStatuses,
  invoiceStatuses,
  paymentStatuses,
  paymentMethods,
  vehicleStatuses,
  checklistTargets,
  checklistItemTypes,
  maintenanceStatuses,
  timeEntryCategories,
  costCategories,
  timeOffStatuses
} from "@shared/schema";
import { z } from "zod";

// Validation schema for staff profile updates
const updateStaffSchema = z.object({
  roles: z.array(z.enum(userRoles)).optional(),
  employmentType: z.enum(employmentTypes).optional(),
  permissions: z.array(z.enum(userPermissions)).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().optional(),
  skills: z.array(z.string()).optional(),
  salaryType: z.enum(["hourly", "annual"]).optional(),
  salaryAmount: z.string().optional(),
  overtimeRateMultiplier: z.string().optional(),
  overtimeThresholdHours: z.string().optional(),
  emailSignature: z.string().optional(),
  timezone: z.string().optional(),
  lunchBreakMinutes: z.number().optional(),
  lunchBreakPaid: z.boolean().optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Setup object storage routes (requires auth)
  const { registerObjectStorageRoutes } = await import("./replit_integrations/object_storage");
  registerObjectStorageRoutes(app);

  // =====================
  // OTP AUTHENTICATION ROUTES
  // =====================

  // Helper to generate 6-digit OTP code
  const generateOTPCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Request OTP code (email or phone)
  app.post("/api/auth/otp/request", async (req, res) => {
    try {
      const { email, phone } = req.body;
      
      if (!email && !phone) {
        return res.status(400).json({ message: "Email or phone is required" });
      }

      const code = generateOTPCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Create verification code
      await storage.createVerificationCode({
        email: email?.toLowerCase(),
        phone,
        code,
        purpose: "login",
        expiresAt,
      });

      // In production, send the code via email/SMS
      // For now, log it for testing
      console.log(`OTP Code for ${email || phone}: ${code}`);

      // TODO: Integrate with Resend for email sending
      // TODO: Integrate with Twilio for SMS sending

      res.json({ 
        message: "Verification code sent",
      });
    } catch (err: any) {
      console.error("Error requesting OTP:", err);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  // Verify OTP code and login
  app.post("/api/auth/otp/verify", async (req: any, res) => {
    try {
      const { email, phone, code } = req.body;
      
      if ((!email && !phone) || !code) {
        return res.status(400).json({ message: "Email/phone and code are required" });
      }

      // Find the verification code
      const verification = await storage.getVerificationCode(code, email, phone);
      
      if (!verification) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      if (verification.usedAt) {
        return res.status(400).json({ message: "Code has already been used" });
      }

      if (new Date() > verification.expiresAt) {
        return res.status(400).json({ message: "Code has expired" });
      }

      // Mark code as used
      await storage.markVerificationCodeUsed(verification.id);

      // Find or create auth identity
      const identifier = email || phone;
      const identityType = email ? "email" : "phone";
      let identity = await storage.getAuthIdentityByIdentifier(identityType, identifier);
      
      if (!identity) {
        // Create new identity with a generated userId
        const newUserId = `${identityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        identity = await storage.createAuthIdentity({
          userId: newUserId,
          type: identityType,
          identifier,
          isVerified: true,
          isPrimary: true,
        });
      } else {
        // Update last used time
        await storage.updateAuthIdentity(identity.id, {
          lastUsedAt: new Date(),
          isVerified: true,
        });
      }

      // Set session
      if (req.session) {
        req.session.userId = identity.userId;
        req.session.authType = identityType;
        req.session.isAuthenticated = true;
      }

      // Get user memberships to determine which org to log into
      const memberships = await storage.getUserMemberships(identity.userId);
      
      res.json({ 
        message: "Login successful",
        userId: identity.userId,
        memberships: memberships.map(m => ({
          organizationId: m.organizationId,
          role: m.role,
        })),
      });
    } catch (err: any) {
      console.error("Error verifying OTP:", err);
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // Get current session info for OTP-authenticated users
  app.get("/api/auth/session", async (req: any, res) => {
    try {
      // Check for Replit Auth first
      if (req.user?.claims?.sub) {
        return res.json({
          isAuthenticated: true,
          authType: "replit",
          userId: req.user.claims.sub,
          user: req.user.claims,
        });
      }

      // Check for OTP session
      if (req.session?.isAuthenticated && req.session?.userId) {
        const memberships = await storage.getUserMemberships(req.session.userId);
        const identities = await storage.getAuthIdentities(req.session.userId);
        
        return res.json({
          isAuthenticated: true,
          authType: req.session.authType,
          userId: req.session.userId,
          memberships,
          identities: identities.map(i => ({
            type: i.type,
            identifier: i.identifier,
            isVerified: i.isVerified,
          })),
        });
      }

      res.json({ isAuthenticated: false });
    } catch (err: any) {
      console.error("Error getting session:", err);
      res.status(500).json({ message: "Failed to get session" });
    }
  });

  // Logout
  app.post("/api/auth/otp/logout", (req: any, res) => {
    if (req.session) {
      req.session.destroy((err: any) => {
        if (err) {
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.json({ message: "Logged out successfully" });
      });
    } else {
      res.json({ message: "No session to logout" });
    }
  });

  // =====================
  // PASSWORD AUTHENTICATION ROUTES
  // =====================

  // Register with email/password
  app.post("/api/auth/register", async (req: any, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      // Check if email already exists
      const existing = await storage.getAuthIdentityByIdentifier("email", email.toLowerCase());
      if (existing) {
        return res.status(400).json({ message: "Email is already registered" });
      }

      // Hash password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 12);

      // Create new user identity
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const identity = await storage.createAuthIdentity({
        userId: newUserId,
        type: "email",
        identifier: email.toLowerCase(),
        passwordHash,
        isVerified: false, // Require email verification
        isPrimary: true,
      });

      // Send verification code
      const code = generateOTPCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await storage.createVerificationCode({
        email: email.toLowerCase(),
        code,
        purpose: "verify_email",
        expiresAt,
      });

      console.log(`Verification code for ${email}: ${code}`);

      res.status(201).json({
        message: "Account created. Please verify your email.",
        userId: newUserId,
        requiresVerification: true,
      });
    } catch (err: any) {
      console.error("Error registering:", err);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Login with email/password
  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find the email identity
      const identity = await storage.getAuthIdentityByIdentifier("email", email.toLowerCase());
      
      if (!identity) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!identity.passwordHash) {
        return res.status(400).json({ 
          message: "This account uses passwordless login. Please request an OTP code instead.",
          useOTP: true,
        });
      }

      // Verify password
      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(password, identity.passwordHash);
      
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Update last used time
      await storage.updateAuthIdentity(identity.id, {
        lastUsedAt: new Date(),
      });

      // Set session
      if (req.session) {
        req.session.userId = identity.userId;
        req.session.authType = "email";
        req.session.isAuthenticated = true;
      }

      // Get user memberships
      const memberships = await storage.getUserMemberships(identity.userId);

      res.json({
        message: "Login successful",
        userId: identity.userId,
        isVerified: identity.isVerified,
        memberships: memberships.map(m => ({
          organizationId: m.organizationId,
          role: m.role,
        })),
      });
    } catch (err: any) {
      console.error("Error logging in:", err);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Verify email after registration
  app.post("/api/auth/verify-email", async (req: any, res) => {
    try {
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }

      // Find the verification code
      const verification = await storage.getVerificationCode(code, email.toLowerCase());
      
      if (!verification) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      if (verification.usedAt) {
        return res.status(400).json({ message: "Code has already been used" });
      }

      if (new Date() > verification.expiresAt) {
        return res.status(400).json({ message: "Code has expired" });
      }

      // Mark code as used
      await storage.markVerificationCodeUsed(verification.id);

      // Mark email as verified
      const identity = await storage.getAuthIdentityByIdentifier("email", email.toLowerCase());
      if (identity) {
        await storage.updateAuthIdentity(identity.id, {
          isVerified: true,
        });
      }

      res.json({ message: "Email verified successfully" });
    } catch (err: any) {
      console.error("Error verifying email:", err);
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  // Request password reset
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Find the email identity
      const identity = await storage.getAuthIdentityByIdentifier("email", email.toLowerCase());
      
      // Don't reveal if email exists or not
      if (identity && identity.passwordHash) {
        const code = generateOTPCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await storage.createVerificationCode({
          email: email.toLowerCase(),
          code,
          purpose: "password_reset",
          expiresAt,
        });

        console.log(`Password reset code for ${email}: ${code}`);
        // TODO: Send email with Resend
      }

      res.json({ 
        message: "If this email exists, a password reset code will be sent.",
      });
    } catch (err: any) {
      console.error("Error requesting password reset:", err);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Reset password with code
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      
      if (!email || !code || !newPassword) {
        return res.status(400).json({ message: "Email, code, and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      // Find the verification code
      const verification = await storage.getVerificationCode(code, email.toLowerCase());
      
      if (!verification) {
        return res.status(400).json({ message: "Invalid reset code" });
      }

      if (verification.usedAt) {
        return res.status(400).json({ message: "Code has already been used" });
      }

      if (new Date() > verification.expiresAt) {
        return res.status(400).json({ message: "Code has expired" });
      }

      if (verification.purpose !== "password_reset") {
        return res.status(400).json({ message: "Invalid code type" });
      }

      // Mark code as used
      await storage.markVerificationCodeUsed(verification.id);

      // Update password
      const identity = await storage.getAuthIdentityByIdentifier("email", email.toLowerCase());
      if (identity) {
        const bcrypt = await import("bcrypt");
        const passwordHash = await bcrypt.hash(newPassword, 12);
        
        await storage.updateAuthIdentity(identity.id, {
          passwordHash,
        });
      }

      res.json({ message: "Password reset successfully" });
    } catch (err: any) {
      console.error("Error resetting password:", err);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Change password (authenticated)
  app.post("/api/auth/change-password", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      // Get user's email identity
      const identities = await storage.getAuthIdentities(userId);
      const emailIdentity = identities.find(i => i.type === "email" && i.passwordHash);
      
      if (!emailIdentity) {
        return res.status(400).json({ message: "No password-based login found for this account" });
      }

      // Verify current password
      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(currentPassword, emailIdentity.passwordHash!);
      
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Update password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await storage.updateAuthIdentity(emailIdentity.id, {
        passwordHash,
      });

      res.json({ message: "Password changed successfully" });
    } catch (err: any) {
      console.error("Error changing password:", err);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Add password to existing OTP account
  app.post("/api/auth/set-password", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      // Get user's email identity
      const identity = await storage.getAuthIdentityByIdentifier("email", email.toLowerCase());
      
      if (!identity) {
        return res.status(400).json({ message: "Email not found" });
      }

      if (identity.userId !== userId) {
        return res.status(403).json({ message: "This email belongs to another account" });
      }

      if (identity.passwordHash) {
        return res.status(400).json({ message: "Password already set. Use change-password instead." });
      }

      // Set password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 12);
      
      await storage.updateAuthIdentity(identity.id, {
        passwordHash,
      });

      res.json({ message: "Password set successfully" });
    } catch (err: any) {
      console.error("Error setting password:", err);
      res.status(500).json({ message: "Failed to set password" });
    }
  });

  // =====================
  // SUBSCRIPTION FEATURE GATING MIDDLEWARE
  // =====================

  // Define features by tier
  const tierFeatures: Record<string, string[]> = {
    starter: ["jobs", "schedule", "basic_reports"],
    professional: ["jobs", "schedule", "basic_reports", "quotes", "invoices", "time_tracking", "vehicles", "checklists"],
    scale: ["jobs", "schedule", "basic_reports", "quotes", "invoices", "time_tracking", "vehicles", "checklists", "kpi", "capacity", "backcosting", "analytics", "custom_integrations"],
  };

  const tierLimits: Record<string, { maxUsers: number; maxJobs: number }> = {
    starter: { maxUsers: 3, maxJobs: 50 },
    professional: { maxUsers: 15, maxJobs: 500 },
    scale: { maxUsers: -1, maxJobs: -1 }, // -1 means unlimited
  };

  // Middleware to check if a feature is available for the user's organization
  const requireFeature = (feature: string) => async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get user's memberships
      const memberships = await storage.getUserMemberships(userId);
      if (memberships.length === 0) {
        return res.status(403).json({ message: "Not a member of any organization" });
      }

      // Use the first active membership's organization
      const membership = memberships.find(m => m.isActive) || memberships[0];
      const subscription = await storage.getOrganizationSubscription(membership.organizationId);
      
      if (!subscription) {
        return res.status(403).json({ message: "No active subscription" });
      }

      if (subscription.status !== "active" && subscription.status !== "trialing") {
        return res.status(403).json({ message: "Subscription is not active" });
      }

      const availableFeatures = tierFeatures[subscription.tier] || tierFeatures.starter;
      if (!availableFeatures.includes(feature)) {
        return res.status(403).json({ 
          message: `This feature requires a higher subscription tier`,
          feature,
          currentTier: subscription.tier,
          requiredTiers: Object.entries(tierFeatures)
            .filter(([, features]) => features.includes(feature))
            .map(([tier]) => tier),
        });
      }

      // Attach organization context to request
      req.organizationId = membership.organizationId;
      req.organizationRole = membership.role;
      req.subscription = subscription;
      
      next();
    } catch (err) {
      console.error("Error checking feature access:", err);
      res.status(500).json({ message: "Failed to check feature access" });
    }
  };

  // Middleware to check user limits
  const checkUserLimit = async (req: any, res: any, next: any) => {
    try {
      const organizationId = req.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "Organization context required" });
      }

      const subscription = await storage.getOrganizationSubscription(organizationId);
      if (!subscription) {
        return res.status(403).json({ message: "No active subscription" });
      }

      const limits = tierLimits[subscription.tier] || tierLimits.starter;
      if (limits.maxUsers === -1) {
        return next(); // Unlimited
      }

      const members = await storage.getOrganizationMembers(organizationId);
      const activeMembers = members.filter(m => m.isActive);
      
      if (activeMembers.length >= limits.maxUsers) {
        return res.status(403).json({ 
          message: `User limit reached. Upgrade your plan to add more team members.`,
          currentCount: activeMembers.length,
          limit: limits.maxUsers,
          tier: subscription.tier,
        });
      }

      next();
    } catch (err) {
      console.error("Error checking user limit:", err);
      res.status(500).json({ message: "Failed to check user limit" });
    }
  };

  // Middleware to check job limits
  const checkJobLimit = async (req: any, res: any, next: any) => {
    try {
      const organizationId = req.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "Organization context required" });
      }

      const subscription = await storage.getOrganizationSubscription(organizationId);
      if (!subscription) {
        return res.status(403).json({ message: "No active subscription" });
      }

      const limits = tierLimits[subscription.tier] || tierLimits.starter;
      if (limits.maxJobs === -1) {
        return next(); // Unlimited
      }

      // Check jobs created this month
      const jobs = await storage.getJobs();
      const orgJobs = jobs.filter((j: any) => j.organizationId === organizationId);
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const monthlyJobs = orgJobs.filter((j: any) => new Date(j.createdAt) >= startOfMonth);
      
      if (monthlyJobs.length >= limits.maxJobs) {
        return res.status(403).json({ 
          message: `Monthly job limit reached. Upgrade your plan to create more jobs.`,
          currentCount: monthlyJobs.length,
          limit: limits.maxJobs,
          tier: subscription.tier,
        });
      }

      next();
    } catch (err) {
      console.error("Error checking job limit:", err);
      res.status(500).json({ message: "Failed to check job limit" });
    }
  };

  // Middleware to get organization context for authenticated users
  // Auto-creates a default organization for users without one
  const withOrganization = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return next(); // Not authenticated
      }

      let memberships = await storage.getUserMemberships(userId);
      
      // Auto-create default organization if user has no memberships
      if (memberships.length === 0) {
        // Use OIDC claims for user name if available
        const claims = req.user?.claims || {};
        const firstName = claims.first_name || claims.given_name || "";
        const lastName = claims.last_name || claims.family_name || "";
        const orgName = firstName && lastName 
          ? `${firstName} ${lastName}'s Organization`
          : `Organization ${userId.substring(0, 8)}`;
        
        // Create default organization
        const newOrg = await storage.createOrganization({
          name: orgName,
          slug: `org-${userId.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8)}-${Date.now()}`,
          isOwner: false,
        });
        
        // Create owner membership for this user
        await storage.createOrganizationMember({
          organizationId: newOrg.id,
          userId: userId,
          role: "owner",
          isActive: true,
        });
        
        // Create starter subscription
        await storage.createOrganizationSubscription({
          organizationId: newOrg.id,
          tier: "starter",
          status: "active",
          features: [],
        });
        
        // Refresh memberships
        memberships = await storage.getUserMemberships(userId);
        console.log(`Auto-created organization "${orgName}" for user ${userId}`);
      }
      
      if (memberships.length > 0) {
        const membership = memberships.find(m => m.isActive) || memberships[0];
        req.organizationId = membership.organizationId;
        req.organizationRole = membership.role;
        
        const subscription = await storage.getOrganizationSubscription(membership.organizationId);
        req.subscription = subscription;
      }
      
      next();
    } catch (err) {
      console.error("Error getting organization context:", err);
      next();
    }
  };

  // Super-admin check middleware
  const requireSuperAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user is a member of an owner organization
      const memberships = await storage.getUserMemberships(userId);
      const ownerMembership = memberships.find(async (m) => {
        const org = await storage.getOrganization(m.organizationId);
        return org?.isOwner && m.role === "owner";
      });

      // For now, check if user has an owner membership in any org marked as isOwner
      const orgsWithOwner = await Promise.all(
        memberships.map(async (m) => {
          const org = await storage.getOrganization(m.organizationId);
          return { membership: m, org };
        })
      );
      
      const isSuperAdmin = orgsWithOwner.some(
        ({ membership, org }) => org?.isOwner && (membership.role === "owner" || membership.role === "admin")
      );

      if (!isSuperAdmin) {
        return res.status(403).json({ message: "Super-admin access required" });
      }

      req.isSuperAdmin = true;
      next();
    } catch (err) {
      console.error("Error checking super-admin access:", err);
      res.status(500).json({ message: "Failed to verify admin access" });
    }
  };

  // Check if current user is super-admin
  app.get("/api/auth/is-super-admin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.json({ isSuperAdmin: false });
      }

      const memberships = await storage.getUserMemberships(userId);
      const orgsWithOwner = await Promise.all(
        memberships.map(async (m) => {
          const org = await storage.getOrganization(m.organizationId);
          return { membership: m, org };
        })
      );
      
      const isSuperAdmin = orgsWithOwner.some(
        ({ membership, org }) => org?.isOwner && (membership.role === "owner" || membership.role === "admin")
      );

      res.json({ isSuperAdmin });
    } catch (err) {
      console.error("Error checking super-admin:", err);
      res.json({ isSuperAdmin: false });
    }
  });

  // =====================
  // ORGANIZATION ROUTES
  // =====================

  // Get all organizations (super-admin only)
  app.get("/api/organizations", isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const orgs = await storage.getOrganizations();
      res.json(orgs);
    } catch (err: any) {
      console.error("Error fetching organizations:", err);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  // Get single organization
  app.get("/api/organizations/:id", isAuthenticated, async (req, res) => {
    try {
      const org = await storage.getOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }
      res.json(org);
    } catch (err: any) {
      console.error("Error fetching organization:", err);
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });

  // Create organization
  app.post("/api/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const { name, slug, type, email, phone, address, timezone } = req.body;
      
      if (!name || !slug) {
        return res.status(400).json({ message: "Name and slug are required" });
      }

      // Check if slug is unique
      const existing = await storage.getOrganizationBySlug(slug);
      if (existing) {
        return res.status(400).json({ message: "Slug already in use" });
      }

      const org = await storage.createOrganization({
        name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        type: type || "customer",
        email,
        phone,
        address,
        timezone: timezone || "Australia/Brisbane",
        isActive: true,
        isOwner: false,
      });

      // Create default subscription (starter tier)
      await storage.createOrganizationSubscription({
        organizationId: org.id,
        tier: "starter",
        status: "active",
        maxUsers: 3,
        maxJobs: 50,
        features: ["jobs", "schedule", "basic_reports"],
      });

      // Add the creating user as owner
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (userId) {
        await storage.createOrganizationMember({
          organizationId: org.id,
          userId,
          role: "owner",
          isLocked: true, // Owner cannot be demoted
          joinedAt: new Date(),
          isActive: true,
        });
      }

      res.status(201).json(org);
    } catch (err: any) {
      console.error("Error creating organization:", err);
      res.status(500).json({ message: "Failed to create organization" });
    }
  });

  // Update organization
  app.patch("/api/organizations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { name, email, phone, address, timezone, isActive } = req.body;
      
      const updated = await storage.updateOrganization(req.params.id, {
        name,
        email,
        phone,
        address,
        timezone,
        isActive,
      });

      if (!updated) {
        return res.status(404).json({ message: "Organization not found" });
      }

      res.json(updated);
    } catch (err: any) {
      console.error("Error updating organization:", err);
      res.status(500).json({ message: "Failed to update organization" });
    }
  });

  // Get organization subscription
  app.get("/api/organizations/:id/subscription", isAuthenticated, async (req, res) => {
    try {
      const sub = await storage.getOrganizationSubscription(req.params.id);
      if (!sub) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      res.json(sub);
    } catch (err: any) {
      console.error("Error fetching subscription:", err);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // Update subscription tier
  app.patch("/api/organizations/:id/subscription", isAuthenticated, async (req, res) => {
    try {
      const { tier, maxUsers, maxJobs, features } = req.body;
      
      const existing = await storage.getOrganizationSubscription(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      const updated = await storage.updateOrganizationSubscription(existing.id, {
        tier,
        maxUsers,
        maxJobs,
        features,
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Error updating subscription:", err);
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // Get organization members
  app.get("/api/organizations/:id/members", isAuthenticated, async (req, res) => {
    try {
      const members = await storage.getOrganizationMembers(req.params.id);
      res.json(members);
    } catch (err: any) {
      console.error("Error fetching members:", err);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  // Add organization member
  app.post("/api/organizations/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, role } = req.body;
      
      if (!userId || !role) {
        return res.status(400).json({ message: "UserId and role are required" });
      }

      // Check if member already exists
      const existing = await storage.getOrganizationMember(req.params.id, userId);
      if (existing) {
        return res.status(400).json({ message: "User is already a member" });
      }

      const member = await storage.createOrganizationMember({
        organizationId: req.params.id,
        userId,
        role,
        invitedBy: req.user?.claims?.sub || req.session?.userId,
        invitedAt: new Date(),
        joinedAt: new Date(),
        isActive: true,
      });

      res.status(201).json(member);
    } catch (err: any) {
      console.error("Error adding member:", err);
      res.status(500).json({ message: "Failed to add member" });
    }
  });

  // Update member role
  app.patch("/api/organizations/:orgId/members/:memberId", isAuthenticated, async (req, res) => {
    try {
      const { role, isActive } = req.body;
      
      const updated = await storage.updateOrganizationMember(req.params.memberId, {
        role,
        isActive,
      });

      if (!updated) {
        return res.status(404).json({ message: "Member not found" });
      }

      res.json(updated);
    } catch (err: any) {
      console.error("Error updating member:", err);
      res.status(500).json({ message: "Failed to update member" });
    }
  });

  // Remove member
  app.delete("/api/organizations/:orgId/members/:memberId", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteOrganizationMember(req.params.memberId);
      res.status(204).send();
    } catch (err: any) {
      console.error("Error removing member:", err);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // =====================
  // ORGANIZATION INVITE ROUTES
  // =====================

  // Get organization invites
  app.get("/api/organizations/:id/invites", isAuthenticated, async (req, res) => {
    try {
      const invites = await storage.getOrganizationInvites(req.params.id);
      res.json(invites);
    } catch (err: any) {
      console.error("Error fetching invites:", err);
      res.status(500).json({ message: "Failed to fetch invites" });
    }
  });

  // Create invite
  app.post("/api/organizations/:id/invites", isAuthenticated, async (req: any, res) => {
    try {
      const { email, phone, role } = req.body;
      
      if (!email && !phone) {
        return res.status(400).json({ message: "Email or phone is required" });
      }

      // Generate unique invite code
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      const invite = await storage.createOrganizationInvite({
        organizationId: req.params.id,
        email: email?.toLowerCase(),
        phone,
        role: role || "staff",
        inviteCode,
        invitedBy: req.user?.claims?.sub || req.session?.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      // TODO: Send invite email/SMS

      res.status(201).json({
        ...invite,
        // Include invite code in response
        inviteCode,
      });
    } catch (err: any) {
      console.error("Error creating invite:", err);
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  // Accept invite
  app.post("/api/invites/:code/accept", async (req: any, res) => {
    try {
      const invite = await storage.getInviteByCode(req.params.code);
      
      if (!invite) {
        return res.status(404).json({ message: "Invalid invite code" });
      }

      if (invite.acceptedAt) {
        return res.status(400).json({ message: "Invite has already been used" });
      }

      if (invite.expiresAt && new Date() > invite.expiresAt) {
        return res.status(400).json({ message: "Invite has expired" });
      }

      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user is already a member
      const existing = await storage.getOrganizationMember(invite.organizationId, userId);
      if (existing) {
        return res.status(400).json({ message: "You are already a member of this organization" });
      }

      // Accept the invite
      await storage.acceptInvite(invite.id, userId);

      // Add user as member
      const member = await storage.createOrganizationMember({
        organizationId: invite.organizationId,
        userId,
        role: invite.role,
        invitedBy: invite.invitedBy,
        invitedAt: invite.createdAt,
        joinedAt: new Date(),
        isActive: true,
      });

      // Get organization details
      const org = await storage.getOrganization(invite.organizationId);

      res.json({
        message: "Invite accepted",
        member,
        organization: org,
      });
    } catch (err: any) {
      console.error("Error accepting invite:", err);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  // Delete invite
  app.delete("/api/organizations/:orgId/invites/:inviteId", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteOrganizationInvite(req.params.inviteId);
      res.status(204).send();
    } catch (err: any) {
      console.error("Error deleting invite:", err);
      res.status(500).json({ message: "Failed to delete invite" });
    }
  });

  // Middleware to auto-create staff profile for authenticated users
  const ensureStaffProfile = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
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

  // =====================
  // STAFF PROFILE ROUTES
  // =====================

  // Get all staff profiles
  app.get("/api/staff", isAuthenticated, ensureStaffProfile, async (req, res) => {
    try {
      const profiles = await storage.getStaffProfiles();
      res.json(profiles);
    } catch (err: any) {
      console.error("Error fetching staff:", err);
      res.status(500).json({ message: "Failed to fetch staff profiles" });
    }
  });

  // Get single staff profile
  app.get("/api/staff/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getStaffProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Staff profile not found" });
      }
      res.json(profile);
    } catch (err: any) {
      console.error("Error fetching staff profile:", err);
      res.status(500).json({ message: "Failed to fetch staff profile" });
    }
  });

  // Update staff profile (roles, permissions, employment type)
  app.patch("/api/staff/:id", isAuthenticated, async (req: any, res) => {
    try {
      // Validate input
      const validation = updateStaffSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateStaffProfile(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Staff profile not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating staff profile:", err);
      res.status(500).json({ message: "Failed to update staff profile" });
    }
  });

  // =====================
  // STAFF WORKING HOURS ROUTES
  // =====================

  // Get staff working hours
  app.get("/api/staff/:id/working-hours", isAuthenticated, async (req, res) => {
    try {
      const hours = await storage.getStaffWorkingHours(req.params.id);
      res.json(hours);
    } catch (err: any) {
      console.error("Error fetching working hours:", err);
      res.status(500).json({ message: "Failed to fetch working hours" });
    }
  });

  // Set staff working hours (replaces all existing hours)
  app.put("/api/staff/:id/working-hours", isAuthenticated, async (req, res) => {
    try {
      const { hours } = req.body;
      if (!Array.isArray(hours)) {
        return res.status(400).json({ message: "Hours must be an array" });
      }
      const updated = await storage.setStaffWorkingHours(req.params.id, hours);
      res.json(updated);
    } catch (err: any) {
      console.error("Error setting working hours:", err);
      res.status(500).json({ message: "Failed to set working hours" });
    }
  });

  // =====================
  // JOB ROUTES
  // =====================

  // Get all jobs
  app.get("/api/jobs", isAuthenticated, ensureStaffProfile, async (req, res) => {
    try {
      const { status } = req.query;
      let jobsList;
      if (status && typeof status === "string") {
        jobsList = await storage.getJobsByStatus(status);
      } else {
        jobsList = await storage.getJobs();
      }
      res.json(jobsList);
    } catch (err: any) {
      console.error("Error fetching jobs:", err);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  // Get single job
  app.get("/api/jobs/:id", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (err: any) {
      console.error("Error fetching job:", err);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Create job
  app.post("/api/jobs", isAuthenticated, async (req: any, res) => {
    try {
      const validation = insertJobSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const userId = req.user?.claims?.sub;
      const job = await storage.createJob({
        ...validation.data,
        createdById: userId,
      });
      res.status(201).json(job);
    } catch (err: any) {
      console.error("Error creating job:", err);
      res.status(500).json({ message: "Failed to create job" });
    }
  });

  // Update job
  app.patch("/api/jobs/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertJobSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateJob(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating job:", err);
      res.status(500).json({ message: "Failed to update job" });
    }
  });

  // Delete job
  app.delete("/api/jobs/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteJob(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting job:", err);
      res.status(500).json({ message: "Failed to delete job" });
    }
  });

  // =====================
  // SCHEDULE ROUTES
  // =====================

  // Get all schedule entries
  app.get("/api/schedule", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, jobId, staffId } = req.query;
      
      let entries;
      if (startDate && endDate && typeof startDate === "string" && typeof endDate === "string") {
        entries = await storage.getScheduleEntriesByDateRange(startDate, endDate);
      } else if (jobId && typeof jobId === "string") {
        entries = await storage.getScheduleEntriesByJob(jobId);
      } else if (staffId && typeof staffId === "string") {
        entries = await storage.getScheduleEntriesByStaff(staffId);
      } else {
        entries = await storage.getScheduleEntries();
      }
      res.json(entries);
    } catch (err: any) {
      console.error("Error fetching schedule:", err);
      res.status(500).json({ message: "Failed to fetch schedule entries" });
    }
  });

  // Get single schedule entry
  app.get("/api/schedule/:id", isAuthenticated, async (req, res) => {
    try {
      const entry = await storage.getScheduleEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      res.json(entry);
    } catch (err: any) {
      console.error("Error fetching schedule entry:", err);
      res.status(500).json({ message: "Failed to fetch schedule entry" });
    }
  });

  // Create schedule entry
  app.post("/api/schedule", isAuthenticated, async (req: any, res) => {
    try {
      // Get the user's staff profile as fallback if no staffId provided
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      if (!staffProfile) {
        return res.status(400).json({ message: "Staff profile not found" });
      }

      // Allow assigning to specific staff member or default to current user
      const scheduleData = {
        jobId: req.body.jobId,
        staffId: req.body.staffId || staffProfile.id,
        scheduledDate: req.body.scheduledDate,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        durationHours: req.body.durationHours || "7.5",
        status: req.body.status || "scheduled",
        notes: req.body.notes,
      };

      const validation = insertScheduleEntrySchema.safeParse(scheduleData);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const entry = await storage.createScheduleEntry(validation.data);
      res.status(201).json(entry);
    } catch (err: any) {
      console.error("Error creating schedule entry:", err);
      res.status(500).json({ message: "Failed to create schedule entry" });
    }
  });

  // Create multiple schedule entries at once (for multi-day scheduling)
  app.post("/api/schedule/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      if (!staffProfile) {
        return res.status(400).json({ message: "Staff profile not found" });
      }

      const { entries } = req.body;
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ message: "Entries array is required" });
      }

      const created = [];
      for (const entry of entries) {
        const scheduleData = {
          jobId: entry.jobId,
          staffId: entry.staffId || staffProfile.id,
          scheduledDate: entry.scheduledDate,
          startTime: entry.startTime,
          endTime: entry.endTime,
          durationHours: entry.durationHours || "7.5",
          status: entry.status || "scheduled",
          notes: entry.notes,
        };

        const validation = insertScheduleEntrySchema.safeParse(scheduleData);
        if (!validation.success) {
          return res.status(400).json({ message: validation.error.errors[0].message });
        }

        const createdEntry = await storage.createScheduleEntry(validation.data);
        created.push(createdEntry);
      }

      res.status(201).json(created);
    } catch (err: any) {
      console.error("Error creating bulk schedule entries:", err);
      res.status(500).json({ message: "Failed to create schedule entries" });
    }
  });

  // Mark schedule entry as complete
  app.post("/api/schedule/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateScheduleEntry(req.params.id, { status: "completed" });
      if (!updated) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error completing schedule entry:", err);
      res.status(500).json({ message: "Failed to complete schedule entry" });
    }
  });

  // Cancel schedule entry
  app.post("/api/schedule/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateScheduleEntry(req.params.id, { status: "cancelled" });
      if (!updated) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error cancelling schedule entry:", err);
      res.status(500).json({ message: "Failed to cancel schedule entry" });
    }
  });

  // Reset schedule entry back to scheduled (undo complete/cancel)
  app.post("/api/schedule/:id/reset", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateScheduleEntry(req.params.id, { status: "scheduled" });
      if (!updated) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error resetting schedule entry:", err);
      res.status(500).json({ message: "Failed to reset schedule entry" });
    }
  });

  // Check staff availability for a date
  app.get("/api/schedule/availability/:staffId/:date", isAuthenticated, async (req, res) => {
    try {
      const { staffId, date } = req.params;
      const availability = await storage.getStaffAvailability(staffId, date);
      res.json(availability);
    } catch (err: any) {
      console.error("Error checking availability:", err);
      res.status(500).json({ message: "Failed to check availability" });
    }
  });

  // Update schedule entry
  app.patch("/api/schedule/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertScheduleEntrySchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateScheduleEntry(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating schedule entry:", err);
      res.status(500).json({ message: "Failed to update schedule entry" });
    }
  });

  // Delete schedule entry
  app.delete("/api/schedule/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteScheduleEntry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting schedule entry:", err);
      res.status(500).json({ message: "Failed to delete schedule entry" });
    }
  });

  // =====================
  // PC ITEM ROUTES
  // =====================

  // Get PC items for a job
  app.get("/api/jobs/:jobId/pc-items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getPCItems(req.params.jobId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching PC items:", err);
      res.status(500).json({ message: "Failed to fetch PC items" });
    }
  });

  // Create PC item
  app.post("/api/jobs/:jobId/pc-items", isAuthenticated, async (req, res) => {
    try {
      const validation = insertPCItemSchema.safeParse({
        ...req.body,
        jobId: req.params.jobId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      let linkedScheduleId: string | undefined;

      // Auto-create schedule entry if both dueDate and assignedToId are provided
      if (validation.data.dueDate && validation.data.assignedToId) {
        const scheduleEntry = await storage.createScheduleEntry({
          jobId: req.params.jobId,
          staffId: validation.data.assignedToId,
          scheduledDate: validation.data.dueDate,
          durationHours: "7.5",
          status: "scheduled",
          notes: `Auto-generated from checklist: ${validation.data.title}`,
        });
        linkedScheduleId = scheduleEntry.id;
      }

      const item = await storage.createPCItem({
        ...validation.data,
        linkedScheduleId,
      });
      res.status(201).json(item);
    } catch (err: any) {
      console.error("Error creating PC item:", err);
      res.status(500).json({ message: "Failed to create PC item" });
    }
  });

  // Update PC item
  app.patch("/api/pc-items/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertPCItemSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      // Get current PC item to check if we need to update/create schedule
      const currentItem = await storage.getPCItem(req.params.id);
      if (!currentItem) {
        return res.status(404).json({ message: "PC item not found" });
      }

      // Determine the effective dueDate and assignedToId after update
      const effectiveDueDate = validation.data.dueDate !== undefined ? validation.data.dueDate : currentItem.dueDate;
      const effectiveAssignedToId = validation.data.assignedToId !== undefined ? validation.data.assignedToId : currentItem.assignedToId;
      let linkedScheduleId = currentItem.linkedScheduleId;

      // Handle schedule entry creation/update/deletion based on dueDate and assignedToId
      const effectiveTitle = validation.data.title ?? currentItem.title;
      
      if (effectiveDueDate && effectiveAssignedToId) {
        if (linkedScheduleId) {
          // Update existing schedule entry
          await storage.updateScheduleEntry(linkedScheduleId, {
            scheduledDate: effectiveDueDate,
            staffId: effectiveAssignedToId,
            notes: `Auto-generated from checklist: ${effectiveTitle}`,
          });
        } else {
          // Create new schedule entry
          const scheduleEntry = await storage.createScheduleEntry({
            jobId: currentItem.jobId,
            staffId: effectiveAssignedToId,
            scheduledDate: effectiveDueDate,
            durationHours: "7.5",
            status: "scheduled",
            notes: `Auto-generated from checklist: ${effectiveTitle}`,
          });
          linkedScheduleId = scheduleEntry.id;
        }
      } else if (linkedScheduleId) {
        // Remove linked schedule if dueDate or assignedToId is cleared
        await storage.deleteScheduleEntry(linkedScheduleId);
        linkedScheduleId = null;
      }

      const updated = await storage.updatePCItem(req.params.id, {
        ...validation.data,
        linkedScheduleId,
      });
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating PC item:", err);
      res.status(500).json({ message: "Failed to update PC item" });
    }
  });

  // Complete PC item
  app.post("/api/pc-items/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const completed = await storage.completePCItem(req.params.id, userId);
      if (!completed) {
        return res.status(404).json({ message: "PC item not found" });
      }
      res.json(completed);
    } catch (err: any) {
      console.error("Error completing PC item:", err);
      res.status(500).json({ message: "Failed to complete PC item" });
    }
  });

  // Delete PC item
  app.delete("/api/pc-items/:id", isAuthenticated, async (req, res) => {
    try {
      // Get the PC item first to check for linked schedule
      const pcItem = await storage.getPCItem(req.params.id);
      if (!pcItem) {
        return res.status(404).json({ message: "PC item not found" });
      }

      // Delete linked schedule entry if exists
      if (pcItem.linkedScheduleId) {
        await storage.deleteScheduleEntry(pcItem.linkedScheduleId);
      }

      const deleted = await storage.deletePCItem(req.params.id);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting PC item:", err);
      res.status(500).json({ message: "Failed to delete PC item" });
    }
  });

  // =====================
  // NOTIFICATION ROUTES
  // =====================

  // Get notifications for current user
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const notificationsList = await storage.getNotifications(userId);
      res.json(notificationsList);
    } catch (err: any) {
      console.error("Error fetching notifications:", err);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (err: any) {
      console.error("Error fetching notification count:", err);
      res.status(500).json({ message: "Failed to fetch notification count" });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.markNotificationRead(req.params.id);
      if (!updated) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error marking notification read:", err);
      res.status(500).json({ message: "Failed to mark notification read" });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      await storage.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error marking all notifications read:", err);
      res.status(500).json({ message: "Failed to mark all notifications read" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteNotification(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting notification:", err);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // =====================
  // CLIENT PORTAL ROUTES
  // =====================

  // Generate share link for a job
  app.post("/api/jobs/:jobId/share", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const job = await storage.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const accessToken = await storage.createClientAccessToken({
        jobId: req.params.jobId,
        createdById: userId,
        isActive: true,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      });

      res.status(201).json(accessToken);
    } catch (err: any) {
      console.error("Error creating share link:", err);
      res.status(500).json({ message: "Failed to create share link" });
    }
  });

  // Get share links for a job
  app.get("/api/jobs/:jobId/share", isAuthenticated, async (req, res) => {
    try {
      const tokens = await storage.getClientAccessTokensByJob(req.params.jobId);
      res.json(tokens);
    } catch (err: any) {
      console.error("Error fetching share links:", err);
      res.status(500).json({ message: "Failed to fetch share links" });
    }
  });

  // Revoke share link
  app.delete("/api/share/:id", isAuthenticated, async (req, res) => {
    try {
      const revoked = await storage.revokeClientAccessToken(req.params.id);
      if (!revoked) {
        return res.status(404).json({ message: "Share link not found" });
      }
      res.json({ revoked: true });
    } catch (err: any) {
      console.error("Error revoking share link:", err);
      res.status(500).json({ message: "Failed to revoke share link" });
    }
  });

  // SHORT LINK REDIRECT: /s/:shortCode redirects to full portal link
  app.get("/s/:shortCode", async (req, res) => {
    try {
      const accessToken = await storage.getClientAccessTokenByShortCode(req.params.shortCode);
      if (!accessToken || !accessToken.isActive) {
        return res.status(404).send("Link not found or expired");
      }

      // Check if token is expired
      if (accessToken.expiresAt && new Date(accessToken.expiresAt) < new Date()) {
        return res.status(410).send("This link has expired");
      }

      // Redirect to the full portal page
      res.redirect(`/portal/${accessToken.token}`);
    } catch (err: any) {
      console.error("Error resolving short link:", err);
      res.status(500).send("Error resolving link");
    }
  });

  // PUBLIC: Get job details by token (no auth required)
  app.get("/api/portal/:token", async (req, res) => {
    try {
      const accessToken = await storage.getClientAccessToken(req.params.token);
      if (!accessToken) {
        return res.status(404).json({ message: "Invalid or expired link" });
      }

      // Check if token is expired
      if (accessToken.expiresAt && new Date(accessToken.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This link has expired" });
      }

      const job = await storage.getJob(accessToken.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Get PC items for the job
      const pcItemsList = await storage.getPCItems(accessToken.jobId);

      // Get invoices for the job
      const jobInvoices = await storage.getInvoicesByJob(accessToken.jobId);

      // Return limited job info for client view
      res.json({
        job: {
          id: job.id,
          clientName: job.clientName,
          address: job.address,
          jobType: job.jobType,
          status: job.status,
          description: job.description,
        },
        pcItems: pcItemsList.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          dueDate: item.dueDate,
        })),
        invoices: jobInvoices
          .filter((inv) => inv.status !== "draft")
          .map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
            total: inv.total,
            amountPaid: inv.amountPaid,
            amountDue: inv.amountDue,
            dueDate: inv.dueDate,
          })),
      });
    } catch (err: any) {
      console.error("Error fetching portal data:", err);
      res.status(500).json({ message: "Failed to fetch job details" });
    }
  });

  // =====================
  // QUOTE ROUTES
  // =====================

  // Get all quotes
  app.get("/api/quotes", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.query;
      let quotesList;
      if (status && typeof status === "string") {
        quotesList = await storage.getQuotesByStatus(status);
      } else {
        quotesList = await storage.getQuotes();
      }
      res.json(quotesList);
    } catch (err: any) {
      console.error("Error fetching quotes:", err);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  // Get single quote with line items
  app.get("/api/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const quote = await storage.getQuoteWithLineItems(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (err: any) {
      console.error("Error fetching quote:", err);
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  // Create quote
  app.post("/api/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const validation = insertQuoteSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const userId = req.user?.claims?.sub;
      const quote = await storage.createQuote({
        ...validation.data,
        createdById: userId,
      });
      res.status(201).json(quote);
    } catch (err: any) {
      console.error("Error creating quote:", err);
      res.status(500).json({ message: "Failed to create quote" });
    }
  });

  // Update quote
  app.patch("/api/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertQuoteSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateQuote(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating quote:", err);
      res.status(500).json({ message: "Failed to update quote" });
    }
  });

  // Send quote to client
  app.post("/api/quotes/:id/send", isAuthenticated, async (req, res) => {
    try {
      const quote = await storage.sendQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (err: any) {
      console.error("Error sending quote:", err);
      res.status(500).json({ message: "Failed to send quote" });
    }
  });

  // Accept quote
  app.post("/api/quotes/:id/accept", isAuthenticated, async (req, res) => {
    try {
      const quote = await storage.acceptQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (err: any) {
      console.error("Error accepting quote:", err);
      res.status(500).json({ message: "Failed to accept quote" });
    }
  });

  // Reject quote
  app.post("/api/quotes/:id/reject", isAuthenticated, async (req, res) => {
    try {
      const quote = await storage.rejectQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (err: any) {
      console.error("Error rejecting quote:", err);
      res.status(500).json({ message: "Failed to reject quote" });
    }
  });

  // Convert quote to job
  app.post("/api/quotes/:id/convert-to-job", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.convertQuoteToJob(req.params.id);
      if (!result) {
        return res.status(400).json({ message: "Quote must be accepted before converting to job" });
      }
      res.json(result);
    } catch (err: any) {
      console.error("Error converting quote to job:", err);
      res.status(500).json({ message: "Failed to convert quote to job" });
    }
  });

  // Create quote revision
  app.post("/api/quotes/:id/revise", isAuthenticated, async (req, res) => {
    try {
      const { revisionReason } = req.body;
      if (!revisionReason || typeof revisionReason !== "string") {
        return res.status(400).json({ message: "Revision reason is required" });
      }

      const userId = (req as any).user?.id;
      const newQuote = await storage.createQuoteRevision(req.params.id, revisionReason, userId);
      
      if (!newQuote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      res.status(201).json(newQuote);
    } catch (err: any) {
      console.error("Error creating quote revision:", err);
      res.status(500).json({ message: "Failed to create quote revision" });
    }
  });

  // Get quote revision history
  app.get("/api/quotes/:id/revisions", isAuthenticated, async (req, res) => {
    try {
      const revisions = await storage.getQuoteRevisionHistory(req.params.id);
      res.json(revisions);
    } catch (err: any) {
      console.error("Error fetching quote revisions:", err);
      res.status(500).json({ message: "Failed to fetch quote revisions" });
    }
  });

  // Delete quote
  app.delete("/api/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteQuote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote:", err);
      res.status(500).json({ message: "Failed to delete quote" });
    }
  });

  // =====================
  // INVOICE ROUTES
  // =====================

  // Get all invoices
  app.get("/api/invoices", isAuthenticated, async (req, res) => {
    try {
      const { status, jobId } = req.query;
      let invoicesList;
      if (jobId && typeof jobId === "string") {
        invoicesList = await storage.getInvoicesByJob(jobId);
      } else if (status && typeof status === "string") {
        invoicesList = await storage.getInvoicesByStatus(status);
      } else {
        invoicesList = await storage.getInvoices();
      }
      res.json(invoicesList);
    } catch (err: any) {
      console.error("Error fetching invoices:", err);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Get single invoice with details
  app.get("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const invoice = await storage.getInvoiceWithDetails(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (err: any) {
      console.error("Error fetching invoice:", err);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  // Create invoice
  app.post("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const validation = insertInvoiceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const userId = req.user?.claims?.sub;
      const invoice = await storage.createInvoice({
        ...validation.data,
        createdById: userId,
      });
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error creating invoice:", err);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Create invoice from job
  app.post("/api/jobs/:jobId/invoice", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const invoice = await storage.createInvoiceFromJob(req.params.jobId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error creating invoice from job:", err);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Create invoice from quote
  app.post("/api/quotes/:quoteId/invoice", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const invoice = await storage.createInvoiceFromQuote(req.params.quoteId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error creating invoice from quote:", err);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Update invoice
  app.patch("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertInvoiceSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateInvoice(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating invoice:", err);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  // Send invoice
  app.post("/api/invoices/:id/send", isAuthenticated, async (req, res) => {
    try {
      const invoice = await storage.sendInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (err: any) {
      console.error("Error sending invoice:", err);
      res.status(500).json({ message: "Failed to send invoice" });
    }
  });

  // Delete invoice
  app.delete("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteInvoice(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting invoice:", err);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Generate invoice from job
  app.post("/api/invoices/generate/job/:jobId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const invoice = await storage.createInvoiceFromJob(req.params.jobId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error generating invoice from job:", err);
      res.status(500).json({ message: "Failed to generate invoice" });
    }
  });

  // Generate invoice from quote
  app.post("/api/invoices/generate/quote/:quoteId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const invoice = await storage.createInvoiceFromQuote(req.params.quoteId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Error generating invoice from quote:", err);
      res.status(500).json({ message: "Failed to generate invoice" });
    }
  });

  // =====================
  // LINE ITEM ROUTES
  // =====================

  // Get line items for quote
  app.get("/api/quotes/:quoteId/line-items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getLineItemsByQuote(req.params.quoteId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching line items:", err);
      res.status(500).json({ message: "Failed to fetch line items" });
    }
  });

  // Get line items for invoice
  app.get("/api/invoices/:invoiceId/line-items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getLineItemsByInvoice(req.params.invoiceId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching line items:", err);
      res.status(500).json({ message: "Failed to fetch line items" });
    }
  });

  // Create line item for quote
  app.post("/api/quotes/:quoteId/line-items", isAuthenticated, async (req, res) => {
    try {
      const validation = insertLineItemSchema.safeParse({
        ...req.body,
        quoteId: req.params.quoteId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const item = await storage.createLineItem(validation.data);
      res.status(201).json(item);
    } catch (err: any) {
      console.error("Error creating line item:", err);
      res.status(500).json({ message: "Failed to create line item" });
    }
  });

  // Create line item for invoice
  app.post("/api/invoices/:invoiceId/line-items", isAuthenticated, async (req, res) => {
    try {
      const validation = insertLineItemSchema.safeParse({
        ...req.body,
        invoiceId: req.params.invoiceId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const item = await storage.createLineItem(validation.data);
      res.status(201).json(item);
    } catch (err: any) {
      console.error("Error creating line item:", err);
      res.status(500).json({ message: "Failed to create line item" });
    }
  });

  // Update line item
  app.patch("/api/line-items/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertLineItemSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateLineItem(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Line item not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating line item:", err);
      res.status(500).json({ message: "Failed to update line item" });
    }
  });

  // Delete line item
  app.delete("/api/line-items/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteLineItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Line item not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting line item:", err);
      res.status(500).json({ message: "Failed to delete line item" });
    }
  });

  // =====================
  // QUOTE MILESTONES
  // =====================

  // Get milestones for quote
  app.get("/api/quotes/:quoteId/milestones", isAuthenticated, async (req, res) => {
    try {
      const milestones = await storage.getQuoteMilestones(req.params.quoteId);
      res.json(milestones);
    } catch (err: any) {
      console.error("Error fetching quote milestones:", err);
      res.status(500).json({ message: "Failed to fetch quote milestones" });
    }
  });

  // Create milestone for quote
  app.post("/api/quotes/:quoteId/milestones", isAuthenticated, async (req, res) => {
    try {
      const milestone = await storage.createQuoteMilestone({
        ...req.body,
        quoteId: req.params.quoteId,
      });
      res.status(201).json(milestone);
    } catch (err: any) {
      console.error("Error creating quote milestone:", err);
      res.status(500).json({ message: "Failed to create quote milestone" });
    }
  });

  // Update quote milestone
  app.patch("/api/quote-milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateQuoteMilestone(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Quote milestone not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating quote milestone:", err);
      res.status(500).json({ message: "Failed to update quote milestone" });
    }
  });

  // Delete quote milestone
  app.delete("/api/quote-milestones/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteQuoteMilestone(req.params.id);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote milestone:", err);
      res.status(500).json({ message: "Failed to delete quote milestone" });
    }
  });

  // Delete all milestones for a quote (for replacing milestones)
  app.delete("/api/quotes/:quoteId/milestones", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteQuoteMilestonesByQuote(req.params.quoteId);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote milestones:", err);
      res.status(500).json({ message: "Failed to delete quote milestones" });
    }
  });

  // =====================
  // QUOTE CUSTOM SECTIONS
  // =====================

  // Get custom sections for quote
  app.get("/api/quotes/:quoteId/custom-sections", isAuthenticated, async (req, res) => {
    try {
      const sections = await storage.getQuoteCustomSections(req.params.quoteId);
      res.json(sections);
    } catch (err: any) {
      console.error("Error fetching quote custom sections:", err);
      res.status(500).json({ message: "Failed to fetch quote custom sections" });
    }
  });

  // Create custom section for quote
  app.post("/api/quotes/:quoteId/custom-sections", isAuthenticated, async (req, res) => {
    try {
      const section = await storage.createQuoteCustomSection({
        ...req.body,
        quoteId: req.params.quoteId,
      });
      res.status(201).json(section);
    } catch (err: any) {
      console.error("Error creating quote custom section:", err);
      res.status(500).json({ message: "Failed to create quote custom section" });
    }
  });

  // Update custom section
  app.patch("/api/quote-custom-sections/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateQuoteCustomSection(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Quote custom section not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating quote custom section:", err);
      res.status(500).json({ message: "Failed to update quote custom section" });
    }
  });

  // Delete custom section
  app.delete("/api/quote-custom-sections/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteQuoteCustomSection(req.params.id);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote custom section:", err);
      res.status(500).json({ message: "Failed to delete quote custom section" });
    }
  });

  // Delete all custom sections for a quote
  app.delete("/api/quotes/:quoteId/custom-sections", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteQuoteCustomSectionsByQuote(req.params.quoteId);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting quote custom sections:", err);
      res.status(500).json({ message: "Failed to delete quote custom sections" });
    }
  });

  // =====================
  // TERMS TEMPLATES
  // =====================

  // Get all terms templates
  app.get("/api/terms-templates", isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getTermsTemplates();
      res.json(templates);
    } catch (err: any) {
      console.error("Error fetching terms templates:", err);
      res.status(500).json({ message: "Failed to fetch terms templates" });
    }
  });

  // Get single terms template
  app.get("/api/terms-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getTermsTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (err: any) {
      console.error("Error fetching terms template:", err);
      res.status(500).json({ message: "Failed to fetch terms template" });
    }
  });

  // Create terms template
  app.post("/api/terms-templates", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertTermsTemplateSchema.safeParse({
        ...req.body,
        createdById: req.user?.id,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid template data", errors: parsed.error.issues });
      }
      const template = await storage.createTermsTemplate(parsed.data);
      res.status(201).json(template);
    } catch (err: any) {
      console.error("Error creating terms template:", err);
      res.status(500).json({ message: "Failed to create terms template" });
    }
  });

  // Update terms template
  app.patch("/api/terms-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const updateSchema = insertTermsTemplateSchema.partial();
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid template data", errors: parsed.error.issues });
      }
      const updated = await storage.updateTermsTemplate(req.params.id, parsed.data);
      if (!updated) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating terms template:", err);
      res.status(500).json({ message: "Failed to update terms template" });
    }
  });

  // Delete terms template
  app.delete("/api/terms-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteTermsTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting terms template:", err);
      res.status(500).json({ message: "Failed to delete terms template" });
    }
  });

  // =====================
  // QUOTE PAYMENT SCHEDULES
  // =====================

  // Get payment schedules for quote
  app.get("/api/quotes/:quoteId/payment-schedules", isAuthenticated, async (req, res) => {
    try {
      const schedules = await storage.getQuotePaymentSchedules(req.params.quoteId);
      res.json(schedules);
    } catch (err: any) {
      console.error("Error fetching payment schedules:", err);
      res.status(500).json({ message: "Failed to fetch payment schedules" });
    }
  });

  // Create payment schedule for quote
  app.post("/api/quotes/:quoteId/payment-schedules", isAuthenticated, async (req, res) => {
    try {
      const schedule = await storage.createQuotePaymentSchedule({
        ...req.body,
        quoteId: req.params.quoteId,
      });
      res.status(201).json(schedule);
    } catch (err: any) {
      console.error("Error creating payment schedule:", err);
      res.status(500).json({ message: "Failed to create payment schedule" });
    }
  });

  // Update payment schedule
  app.patch("/api/payment-schedules/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateQuotePaymentSchedule(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Payment schedule not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating payment schedule:", err);
      res.status(500).json({ message: "Failed to update payment schedule" });
    }
  });

  // Delete payment schedule
  app.delete("/api/payment-schedules/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteQuotePaymentSchedule(req.params.id);
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting payment schedule:", err);
      res.status(500).json({ message: "Failed to delete payment schedule" });
    }
  });

  // Mark payment schedule as paid
  app.post("/api/payment-schedules/:id/mark-paid", isAuthenticated, async (req, res) => {
    try {
      const { paidAmount } = req.body;
      const updated = await storage.markPaymentSchedulePaid(req.params.id, paidAmount);
      if (!updated) {
        return res.status(404).json({ message: "Payment schedule not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error marking payment as paid:", err);
      res.status(500).json({ message: "Failed to mark payment as paid" });
    }
  });

  // =====================
  // QUOTE WORKFLOW EVENTS
  // =====================

  // Get workflow events for quote
  app.get("/api/quotes/:quoteId/workflow-events", isAuthenticated, async (req, res) => {
    try {
      const events = await storage.getQuoteWorkflowEvents(req.params.quoteId);
      res.json(events);
    } catch (err: any) {
      console.error("Error fetching workflow events:", err);
      res.status(500).json({ message: "Failed to fetch workflow events" });
    }
  });

  // =====================
  // ORGANIZATION SETTINGS
  // =====================

  // Get organization settings
  app.get("/api/organizations/:orgId/settings", isAuthenticated, async (req, res) => {
    try {
      let settings = await storage.getOrganizationSettings(req.params.orgId);
      if (!settings) {
        // Create default settings if not exists
        settings = await storage.createOrganizationSettings({
          organizationId: req.params.orgId,
        });
      }
      res.json(settings);
    } catch (err: any) {
      console.error("Error fetching organization settings:", err);
      res.status(500).json({ message: "Failed to fetch organization settings" });
    }
  });

  // Update organization settings
  app.patch("/api/organizations/:orgId/settings", isAuthenticated, async (req, res) => {
    try {
      let settings = await storage.getOrganizationSettings(req.params.orgId);
      if (!settings) {
        settings = await storage.createOrganizationSettings({
          ...req.body,
          organizationId: req.params.orgId,
        });
      } else {
        settings = await storage.updateOrganizationSettings(req.params.orgId, req.body);
      }
      res.json(settings);
    } catch (err: any) {
      console.error("Error updating organization settings:", err);
      res.status(500).json({ message: "Failed to update organization settings" });
    }
  });

  // =====================
  // PAYMENT ROUTES
  // =====================

  // Get payments for invoice
  app.get("/api/invoices/:invoiceId/payments", isAuthenticated, async (req, res) => {
    try {
      const paymentsList = await storage.getPaymentsByInvoice(req.params.invoiceId);
      res.json(paymentsList);
    } catch (err: any) {
      console.error("Error fetching payments:", err);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // Create payment (and auto-convert quote to job if applicable)
  app.post("/api/invoices/:invoiceId/payments", isAuthenticated, async (req, res) => {
    try {
      const validation = insertPaymentSchema.safeParse({
        ...req.body,
        invoiceId: req.params.invoiceId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      // Get the invoice to check if it has a linked quote
      const invoice = await storage.getInvoice(req.params.invoiceId);
      let convertedJob = null;
      
      if (invoice?.quoteId) {
        // Check if quote needs to be converted to job
        const quote = await storage.getQuote(invoice.quoteId);
        if (quote && !quote.convertedToJobId) {
          // First, accept the quote if not already accepted
          if (quote.status !== "accepted") {
            await storage.acceptQuote(quote.id);
          }
          
          // Now convert the quote to a job
          const result = await storage.convertQuoteToJob(invoice.quoteId);
          if (result) {
            convertedJob = result.job;
          }
        }
      }

      const payment = await storage.createPayment(validation.data);
      res.status(201).json({ 
        payment, 
        convertedJob,
        message: convertedJob ? "Payment recorded and quote converted to job" : "Payment recorded"
      });
    } catch (err: any) {
      console.error("Error creating payment:", err);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  // Complete payment
  app.post("/api/payments/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const payment = await storage.completePayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (err: any) {
      console.error("Error completing payment:", err);
      res.status(500).json({ message: "Failed to complete payment" });
    }
  });

  // Update payment
  app.patch("/api/payments/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertPaymentSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updatePayment(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating payment:", err);
      res.status(500).json({ message: "Failed to update payment" });
    }
  });

  // =====================
  // PHASE 4: VEHICLE ROUTES
  // =====================

  // List all vehicles
  app.get("/api/vehicles", isAuthenticated, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const vehiclesList = status 
        ? await storage.getVehiclesByStatus(status)
        : await storage.getVehicles();
      res.json(vehiclesList);
    } catch (err: any) {
      console.error("Error fetching vehicles:", err);
      res.status(500).json({ message: "Failed to fetch vehicles" });
    }
  });

  // Get single vehicle with current assignment
  app.get("/api/vehicles/:id", isAuthenticated, async (req, res) => {
    try {
      const vehicle = await storage.getVehicleWithAssignment(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (err: any) {
      console.error("Error fetching vehicle:", err);
      res.status(500).json({ message: "Failed to fetch vehicle" });
    }
  });

  // Create vehicle
  app.post("/api/vehicles", isAuthenticated, async (req, res) => {
    try {
      const validation = insertVehicleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const vehicle = await storage.createVehicle(validation.data);
      res.status(201).json(vehicle);
    } catch (err: any) {
      console.error("Error creating vehicle:", err);
      res.status(500).json({ message: "Failed to create vehicle" });
    }
  });

  // Update vehicle
  app.patch("/api/vehicles/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertVehicleSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateVehicle(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating vehicle:", err);
      res.status(500).json({ message: "Failed to update vehicle" });
    }
  });

  // Delete vehicle
  app.delete("/api/vehicles/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteVehicle(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting vehicle:", err);
      res.status(500).json({ message: "Failed to delete vehicle" });
    }
  });

  // =====================
  // VEHICLE ASSIGNMENT ROUTES
  // =====================

  // Get vehicle assignments
  app.get("/api/vehicles/:vehicleId/assignments", isAuthenticated, async (req, res) => {
    try {
      const assignments = await storage.getVehicleAssignments(req.params.vehicleId);
      res.json(assignments);
    } catch (err: any) {
      console.error("Error fetching assignments:", err);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  // Assign vehicle to staff
  app.post("/api/vehicles/:vehicleId/assign", isAuthenticated, async (req: any, res) => {
    try {
      const validation = insertVehicleAssignmentSchema.safeParse({
        ...req.body,
        vehicleId: req.params.vehicleId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const assignment = await storage.assignVehicle(validation.data);
      res.status(201).json(assignment);
    } catch (err: any) {
      console.error("Error assigning vehicle:", err);
      res.status(500).json({ message: "Failed to assign vehicle" });
    }
  });

  // Return vehicle (end assignment)
  app.post("/api/vehicle-assignments/:id/return", isAuthenticated, async (req, res) => {
    try {
      const returned = await storage.returnVehicle(req.params.id);
      if (!returned) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.json(returned);
    } catch (err: any) {
      console.error("Error returning vehicle:", err);
      res.status(500).json({ message: "Failed to return vehicle" });
    }
  });

  // =====================
  // CHECKLIST TEMPLATE ROUTES
  // =====================

  // List checklist templates
  app.get("/api/checklist-templates", isAuthenticated, async (req, res) => {
    try {
      const target = req.query.target as string | undefined;
      const templates = target
        ? await storage.getChecklistTemplatesByTarget(target)
        : await storage.getChecklistTemplates();
      res.json(templates);
    } catch (err: any) {
      console.error("Error fetching checklist templates:", err);
      res.status(500).json({ message: "Failed to fetch checklist templates" });
    }
  });

  // Get single checklist template with items
  app.get("/api/checklist-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getChecklistTemplateWithItems(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (err: any) {
      console.error("Error fetching checklist template:", err);
      res.status(500).json({ message: "Failed to fetch checklist template" });
    }
  });

  // Create checklist template
  app.post("/api/checklist-templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const validation = insertChecklistTemplateSchema.safeParse({
        ...req.body,
        createdById: userId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const template = await storage.createChecklistTemplate(validation.data);
      res.status(201).json(template);
    } catch (err: any) {
      console.error("Error creating checklist template:", err);
      res.status(500).json({ message: "Failed to create checklist template" });
    }
  });

  // Update checklist template
  app.patch("/api/checklist-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertChecklistTemplateSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateChecklistTemplate(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating checklist template:", err);
      res.status(500).json({ message: "Failed to update checklist template" });
    }
  });

  // Delete checklist template
  app.delete("/api/checklist-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteChecklistTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting checklist template:", err);
      res.status(500).json({ message: "Failed to delete checklist template" });
    }
  });

  // =====================
  // CHECKLIST TEMPLATE ITEM ROUTES
  // =====================

  // Get template items
  app.get("/api/checklist-templates/:templateId/items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getChecklistTemplateItems(req.params.templateId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching template items:", err);
      res.status(500).json({ message: "Failed to fetch template items" });
    }
  });

  // Create template item
  app.post("/api/checklist-templates/:templateId/items", isAuthenticated, async (req, res) => {
    try {
      const validation = insertChecklistTemplateItemSchema.safeParse({
        ...req.body,
        templateId: req.params.templateId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const item = await storage.createChecklistTemplateItem(validation.data);
      res.status(201).json(item);
    } catch (err: any) {
      console.error("Error creating template item:", err);
      res.status(500).json({ message: "Failed to create template item" });
    }
  });

  // Update template item
  app.patch("/api/checklist-template-items/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertChecklistTemplateItemSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateChecklistTemplateItem(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating template item:", err);
      res.status(500).json({ message: "Failed to update template item" });
    }
  });

  // Delete template item
  app.delete("/api/checklist-template-items/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteChecklistTemplateItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting template item:", err);
      res.status(500).json({ message: "Failed to delete template item" });
    }
  });

  // =====================
  // CHECKLIST RUN ROUTES
  // =====================

  // List checklist runs with optional filters
  app.get("/api/checklist-runs", isAuthenticated, async (req, res) => {
    try {
      const filters = {
        vehicleId: req.query.vehicleId as string | undefined,
        jobId: req.query.jobId as string | undefined,
        completedById: req.query.completedById as string | undefined,
      };
      const runs = await storage.getChecklistRuns(filters);
      res.json(runs);
    } catch (err: any) {
      console.error("Error fetching checklist runs:", err);
      res.status(500).json({ message: "Failed to fetch checklist runs" });
    }
  });

  // Get single checklist run with items
  app.get("/api/checklist-runs/:id", isAuthenticated, async (req, res) => {
    try {
      const run = await storage.getChecklistRunWithItems(req.params.id);
      if (!run) {
        return res.status(404).json({ message: "Checklist run not found" });
      }
      res.json(run);
    } catch (err: any) {
      console.error("Error fetching checklist run:", err);
      res.status(500).json({ message: "Failed to fetch checklist run" });
    }
  });

  // Start a new checklist run
  app.post("/api/checklist-runs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      
      const validation = insertChecklistRunSchema.safeParse({
        ...req.body,
        completedById: staffProfile?.id,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const run = await storage.startChecklistRun(validation.data);
      res.status(201).json(run);
    } catch (err: any) {
      console.error("Error starting checklist run:", err);
      res.status(500).json({ message: "Failed to start checklist run" });
    }
  });

  // Complete a checklist run
  app.post("/api/checklist-runs/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const completed = await storage.completeChecklistRun(req.params.id);
      if (!completed) {
        return res.status(404).json({ message: "Checklist run not found" });
      }
      res.json(completed);
    } catch (err: any) {
      console.error("Error completing checklist run:", err);
      res.status(500).json({ message: "Failed to complete checklist run" });
    }
  });

  // =====================
  // CHECKLIST RUN ITEM ROUTES
  // =====================

  // Get run items
  app.get("/api/checklist-runs/:runId/items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getChecklistRunItems(req.params.runId);
      res.json(items);
    } catch (err: any) {
      console.error("Error fetching run items:", err);
      res.status(500).json({ message: "Failed to fetch run items" });
    }
  });

  // Update run item (answer a checklist question)
  app.patch("/api/checklist-run-items/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertChecklistRunItemSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateChecklistRunItem(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating run item:", err);
      res.status(500).json({ message: "Failed to update run item" });
    }
  });

  // =====================
  // JOB PHOTO ROUTES
  // =====================

  // Get photos for a job
  app.get("/api/jobs/:jobId/photos", isAuthenticated, async (req, res) => {
    try {
      const photos = await storage.getJobPhotos(req.params.jobId);
      res.json(photos);
    } catch (err: any) {
      console.error("Error fetching job photos:", err);
      res.status(500).json({ message: "Failed to fetch job photos" });
    }
  });

  // Get single photo
  app.get("/api/job-photos/:id", isAuthenticated, async (req, res) => {
    try {
      const photo = await storage.getJobPhoto(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      res.json(photo);
    } catch (err: any) {
      console.error("Error fetching job photo:", err);
      res.status(500).json({ message: "Failed to fetch job photo" });
    }
  });

  // Upload photo metadata (actual file upload handled separately)
  app.post("/api/jobs/:jobId/photos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      // Generate filename from URL if not provided
      let filename = req.body.filename;
      if (!filename && req.body.url) {
        try {
          const urlObj = new URL(req.body.url);
          filename = urlObj.pathname.split('/').pop() || `photo-${Date.now()}.jpg`;
        } catch {
          filename = `photo-${Date.now()}.jpg`;
        }
      }

      const validation = insertJobPhotoSchema.safeParse({
        ...req.body,
        filename,
        jobId: req.params.jobId,
        uploadedById: staffProfile?.id,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const photo = await storage.createJobPhoto(validation.data);
      res.status(201).json(photo);
    } catch (err: any) {
      console.error("Error creating job photo:", err);
      res.status(500).json({ message: "Failed to create job photo" });
    }
  });

  // Update photo (caption, category)
  app.patch("/api/job-photos/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertJobPhotoSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateJobPhoto(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Photo not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating job photo:", err);
      res.status(500).json({ message: "Failed to update job photo" });
    }
  });

  // Delete photo
  app.delete("/api/job-photos/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteJobPhoto(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Photo not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting job photo:", err);
      res.status(500).json({ message: "Failed to delete job photo" });
    }
  });

  // =====================
  // JOB RECEIPT ROUTES
  // =====================

  // Get receipts for a job
  app.get("/api/jobs/:jobId/receipts", isAuthenticated, async (req, res) => {
    try {
      const receipts = await storage.getJobReceipts(req.params.jobId);
      res.json(receipts);
    } catch (err: any) {
      console.error("Error fetching job receipts:", err);
      res.status(500).json({ message: "Failed to fetch job receipts" });
    }
  });

  // Get single receipt
  app.get("/api/job-receipts/:id", isAuthenticated, async (req, res) => {
    try {
      const receipt = await storage.getJobReceipt(req.params.id);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.json(receipt);
    } catch (err: any) {
      console.error("Error fetching job receipt:", err);
      res.status(500).json({ message: "Failed to fetch job receipt" });
    }
  });

  // Upload receipt (scan or file)
  app.post("/api/jobs/:jobId/receipts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      // Generate filename from URL if not provided
      let filename = req.body.filename;
      if (!filename && req.body.url) {
        try {
          const urlObj = new URL(req.body.url);
          filename = urlObj.pathname.split('/').pop() || `receipt-${Date.now()}.jpg`;
        } catch {
          filename = `receipt-${Date.now()}.jpg`;
        }
      }

      const validation = insertJobReceiptSchema.safeParse({
        ...req.body,
        filename,
        jobId: req.params.jobId,
        uploadedById: staffProfile?.id,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const receipt = await storage.createJobReceipt(validation.data);
      res.status(201).json(receipt);
    } catch (err: any) {
      console.error("Error creating job receipt:", err);
      res.status(500).json({ message: "Failed to create job receipt" });
    }
  });

  // Update receipt (description, vendor, amount, etc.)
  app.patch("/api/job-receipts/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertJobReceiptSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateJobReceipt(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating job receipt:", err);
      res.status(500).json({ message: "Failed to update job receipt" });
    }
  });

  // Delete receipt
  app.delete("/api/job-receipts/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteJobReceipt(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting job receipt:", err);
      res.status(500).json({ message: "Failed to delete job receipt" });
    }
  });

  // =====================
  // VEHICLE MAINTENANCE ROUTES
  // =====================

  // Get maintenance records for a vehicle
  app.get("/api/vehicles/:vehicleId/maintenance", isAuthenticated, async (req, res) => {
    try {
      const records = await storage.getVehicleMaintenanceRecords(req.params.vehicleId);
      res.json(records);
    } catch (err: any) {
      console.error("Error fetching maintenance records:", err);
      res.status(500).json({ message: "Failed to fetch maintenance records" });
    }
  });

  // Get all scheduled maintenance
  app.get("/api/vehicle-maintenance/scheduled", isAuthenticated, async (req, res) => {
    try {
      const records = await storage.getScheduledMaintenance();
      res.json(records);
    } catch (err: any) {
      console.error("Error fetching scheduled maintenance:", err);
      res.status(500).json({ message: "Failed to fetch scheduled maintenance" });
    }
  });

  // Get single maintenance record
  app.get("/api/vehicle-maintenance/:id", isAuthenticated, async (req, res) => {
    try {
      const record = await storage.getVehicleMaintenance(req.params.id);
      if (!record) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      res.json(record);
    } catch (err: any) {
      console.error("Error fetching maintenance record:", err);
      res.status(500).json({ message: "Failed to fetch maintenance record" });
    }
  });

  // Create maintenance record
  app.post("/api/vehicles/:vehicleId/maintenance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const validation = insertVehicleMaintenanceSchema.safeParse({
        ...req.body,
        vehicleId: req.params.vehicleId,
        createdById: userId,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const record = await storage.createVehicleMaintenance(validation.data);
      res.status(201).json(record);
    } catch (err: any) {
      console.error("Error creating maintenance record:", err);
      res.status(500).json({ message: "Failed to create maintenance record" });
    }
  });

  // Update maintenance record
  app.patch("/api/vehicle-maintenance/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertVehicleMaintenanceSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateVehicleMaintenance(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating maintenance record:", err);
      res.status(500).json({ message: "Failed to update maintenance record" });
    }
  });

  // Complete maintenance
  app.post("/api/vehicle-maintenance/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const { completedDate } = req.body;
      if (!completedDate) {
        return res.status(400).json({ message: "Completed date is required" });
      }

      const completed = await storage.completeVehicleMaintenance(req.params.id, completedDate);
      if (!completed) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      res.json(completed);
    } catch (err: any) {
      console.error("Error completing maintenance:", err);
      res.status(500).json({ message: "Failed to complete maintenance" });
    }
  });

  // Delete maintenance record
  app.delete("/api/vehicle-maintenance/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteVehicleMaintenance(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting maintenance record:", err);
      res.status(500).json({ message: "Failed to delete maintenance record" });
    }
  });

  // ==========================================
  // PHASE 5: PRODUCTIVITY, BACKCOSTING & CAPACITY ROUTES
  // ==========================================

  // Time Entry Routes
  app.get("/api/jobs/:jobId/time-entries", isAuthenticated, async (req, res) => {
    try {
      const entries = await storage.getJobTimeEntries(req.params.jobId);
      res.json(entries);
    } catch (err: any) {
      console.error("Error fetching time entries:", err);
      res.status(500).json({ message: "Failed to fetch time entries" });
    }
  });

  app.get("/api/time-entries", isAuthenticated, async (req: any, res) => {
    try {
      const { staffId, dateFrom, dateTo } = req.query;
      let entries;
      
      if (staffId) {
        entries = await storage.getTimeEntriesByStaff(staffId, dateFrom, dateTo);
      } else if (dateFrom && dateTo) {
        entries = await storage.getTimeEntriesByDateRange(dateFrom, dateTo);
      } else {
        // Get current user's entries
        const userId = req.user?.claims?.sub;
        const staffProfile = await storage.getStaffProfileByUserId(userId);
        if (staffProfile) {
          entries = await storage.getTimeEntriesByStaff(staffProfile.id);
        } else {
          entries = [];
        }
      }
      
      res.json(entries);
    } catch (err: any) {
      console.error("Error fetching time entries:", err);
      res.status(500).json({ message: "Failed to fetch time entries" });
    }
  });

  app.post("/api/jobs/:jobId/time-entries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      const validation = insertJobTimeEntrySchema.safeParse({
        ...req.body,
        jobId: req.params.jobId,
        staffId: req.body.staffId || staffProfile?.id,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const entry = await storage.createTimeEntry(validation.data);
      res.status(201).json(entry);
    } catch (err: any) {
      console.error("Error creating time entry:", err);
      res.status(500).json({ message: "Failed to create time entry" });
    }
  });

  app.patch("/api/time-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertJobTimeEntrySchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateTimeEntry(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating time entry:", err);
      res.status(500).json({ message: "Failed to update time entry" });
    }
  });

  app.delete("/api/time-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteTimeEntry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting time entry:", err);
      res.status(500).json({ message: "Failed to delete time entry" });
    }
  });

  // Cost Entry Routes
  app.get("/api/jobs/:jobId/cost-entries", isAuthenticated, async (req, res) => {
    try {
      const entries = await storage.getJobCostEntries(req.params.jobId);
      res.json(entries);
    } catch (err: any) {
      console.error("Error fetching cost entries:", err);
      res.status(500).json({ message: "Failed to fetch cost entries" });
    }
  });

  app.post("/api/jobs/:jobId/cost-entries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      const validation = insertJobCostEntrySchema.safeParse({
        ...req.body,
        jobId: req.params.jobId,
        recordedById: staffProfile?.id,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const entry = await storage.createCostEntry(validation.data);
      res.status(201).json(entry);
    } catch (err: any) {
      console.error("Error creating cost entry:", err);
      res.status(500).json({ message: "Failed to create cost entry" });
    }
  });

  app.patch("/api/cost-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const partialSchema = insertJobCostEntrySchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const updated = await storage.updateCostEntry(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Cost entry not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating cost entry:", err);
      res.status(500).json({ message: "Failed to update cost entry" });
    }
  });

  app.delete("/api/cost-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteCostEntry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Cost entry not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting cost entry:", err);
      res.status(500).json({ message: "Failed to delete cost entry" });
    }
  });

  // Staff Capacity Rules Routes
  app.get("/api/capacity-rules", isAuthenticated, async (req, res) => {
    try {
      const rules = await storage.getStaffCapacityRules();
      res.json(rules);
    } catch (err: any) {
      console.error("Error fetching capacity rules:", err);
      res.status(500).json({ message: "Failed to fetch capacity rules" });
    }
  });

  app.get("/api/capacity-rules/:staffId", isAuthenticated, async (req, res) => {
    try {
      const rule = await storage.getStaffCapacityRule(req.params.staffId);
      if (!rule) {
        return res.status(404).json({ message: "Capacity rule not found" });
      }
      res.json(rule);
    } catch (err: any) {
      console.error("Error fetching capacity rule:", err);
      res.status(500).json({ message: "Failed to fetch capacity rule" });
    }
  });

  app.post("/api/capacity-rules", isAuthenticated, async (req, res) => {
    try {
      const validation = insertStaffCapacityRuleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const rule = await storage.createOrUpdateCapacityRule(validation.data);
      res.status(201).json(rule);
    } catch (err: any) {
      console.error("Error creating capacity rule:", err);
      res.status(500).json({ message: "Failed to create capacity rule" });
    }
  });

  app.delete("/api/capacity-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteCapacityRule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Capacity rule not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting capacity rule:", err);
      res.status(500).json({ message: "Failed to delete capacity rule" });
    }
  });

  // Time Off Routes
  app.get("/api/time-off", isAuthenticated, async (req: any, res) => {
    try {
      const { staffId, dateFrom, dateTo } = req.query;
      let timeOff;
      
      if (staffId) {
        timeOff = await storage.getStaffTimeOff(staffId);
      } else if (dateFrom && dateTo) {
        timeOff = await storage.getTimeOffByDateRange(dateFrom, dateTo);
      } else {
        // Get current user's time off
        const userId = req.user?.claims?.sub;
        const staffProfile = await storage.getStaffProfileByUserId(userId);
        if (staffProfile) {
          timeOff = await storage.getStaffTimeOff(staffProfile.id);
        } else {
          timeOff = [];
        }
      }
      
      res.json(timeOff);
    } catch (err: any) {
      console.error("Error fetching time off:", err);
      res.status(500).json({ message: "Failed to fetch time off" });
    }
  });

  app.post("/api/time-off", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);

      const validation = insertStaffTimeOffSchema.safeParse({
        ...req.body,
        staffId: req.body.staffId || staffProfile?.id,
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const request = await storage.createTimeOffRequest(validation.data);
      res.status(201).json(request);
    } catch (err: any) {
      console.error("Error creating time off request:", err);
      res.status(500).json({ message: "Failed to create time off request" });
    }
  });

  app.post("/api/time-off/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      
      const approved = await storage.approveTimeOff(req.params.id, staffProfile?.id || "");
      if (!approved) {
        return res.status(404).json({ message: "Time off request not found" });
      }
      res.json(approved);
    } catch (err: any) {
      console.error("Error approving time off:", err);
      res.status(500).json({ message: "Failed to approve time off" });
    }
  });

  app.post("/api/time-off/:id/reject", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      
      const rejected = await storage.rejectTimeOff(req.params.id, staffProfile?.id || "");
      if (!rejected) {
        return res.status(404).json({ message: "Time off request not found" });
      }
      res.json(rejected);
    } catch (err: any) {
      console.error("Error rejecting time off:", err);
      res.status(500).json({ message: "Failed to reject time off" });
    }
  });

  app.delete("/api/time-off/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteTimeOff(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Time off request not found" });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      console.error("Error deleting time off:", err);
      res.status(500).json({ message: "Failed to delete time off" });
    }
  });

  // Analytics & Reporting Routes
  app.get("/api/productivity/metrics", isAuthenticated, async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };
      const metrics = await storage.getStaffProductivityMetrics(dateFrom, dateTo);
      res.json(metrics);
    } catch (err: any) {
      console.error("Error fetching productivity metrics:", err);
      res.status(500).json({ message: "Failed to fetch productivity metrics" });
    }
  });

  app.get("/api/backcosting", isAuthenticated, async (req, res) => {
    try {
      const summaries = await storage.getAllJobBackcosting();
      res.json(summaries);
    } catch (err: any) {
      console.error("Error fetching backcosting data:", err);
      res.status(500).json({ message: "Failed to fetch backcosting data" });
    }
  });

  app.get("/api/jobs/:jobId/backcosting", isAuthenticated, async (req, res) => {
    try {
      const summary = await storage.getJobBackcostingSummary(req.params.jobId);
      if (!summary) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(summary);
    } catch (err: any) {
      console.error("Error fetching job backcosting:", err);
      res.status(500).json({ message: "Failed to fetch job backcosting" });
    }
  });

  app.get("/api/capacity", isAuthenticated, async (req, res) => {
    try {
      const { weekStart } = req.query;
      // Default to current week if not specified
      const startDate = weekStart as string || new Date().toISOString().split('T')[0];
      const capacity = await storage.getStaffCapacityView(startDate);
      res.json(capacity);
    } catch (err: any) {
      console.error("Error fetching capacity view:", err);
      res.status(500).json({ message: "Failed to fetch capacity view" });
    }
  });

  // =====================
  // KPI MODULE ROUTES
  // =====================

  // KPI Dashboard - Daily view
  app.get("/api/kpi/dashboard/daily", isAuthenticated, async (req, res) => {
    try {
      const { date } = req.query;
      const dashboard = await storage.getKpiDashboardDaily(date as string);
      res.json(dashboard);
    } catch (err: any) {
      console.error("Error fetching daily KPI dashboard:", err);
      res.status(500).json({ message: "Failed to fetch daily KPI dashboard" });
    }
  });

  // KPI Dashboard - Weekly view
  app.get("/api/kpi/dashboard/weekly", isAuthenticated, async (req, res) => {
    try {
      const { weekStart } = req.query;
      const dashboard = await storage.getKpiDashboardWeekly(weekStart as string);
      res.json(dashboard);
    } catch (err: any) {
      console.error("Error fetching weekly KPI dashboard:", err);
      res.status(500).json({ message: "Failed to fetch weekly KPI dashboard" });
    }
  });

  // KPI Summary for individual tradesman
  app.get("/api/kpi/staff/:staffId/summary", isAuthenticated, async (req, res) => {
    try {
      const summary = await storage.getTradesmanKpiSummary(req.params.staffId);
      if (!summary) {
        return res.status(404).json({ message: "Staff not found" });
      }
      res.json(summary);
    } catch (err: any) {
      console.error("Error fetching tradesman KPI summary:", err);
      res.status(500).json({ message: "Failed to fetch tradesman KPI summary" });
    }
  });

  // KPI Snapshots - Daily
  app.get("/api/kpi/snapshots/daily", isAuthenticated, async (req, res) => {
    try {
      const { staffId, dateFrom, dateTo } = req.query;
      const snapshots = await storage.getKpiDailySnapshots(
        staffId as string,
        dateFrom as string,
        dateTo as string
      );
      res.json(snapshots);
    } catch (err: any) {
      console.error("Error fetching daily snapshots:", err);
      res.status(500).json({ message: "Failed to fetch daily snapshots" });
    }
  });

  // KPI Snapshots - Weekly
  app.get("/api/kpi/snapshots/weekly", isAuthenticated, async (req, res) => {
    try {
      const { staffId, weekStart } = req.query;
      const snapshots = await storage.getKpiWeeklySnapshots(
        staffId as string,
        weekStart as string
      );
      res.json(snapshots);
    } catch (err: any) {
      console.error("Error fetching weekly snapshots:", err);
      res.status(500).json({ message: "Failed to fetch weekly snapshots" });
    }
  });

  // KPI Snapshots - Monthly
  app.get("/api/kpi/snapshots/monthly", isAuthenticated, async (req, res) => {
    try {
      const { month } = req.query;
      const snapshots = await storage.getKpiMonthlySnapshots(month as string);
      res.json(snapshots);
    } catch (err: any) {
      console.error("Error fetching monthly snapshots:", err);
      res.status(500).json({ message: "Failed to fetch monthly snapshots" });
    }
  });

  // Calculate and save daily snapshot (typically called by scheduler)
  app.post("/api/kpi/snapshots/daily/:staffId", isAuthenticated, async (req: any, res) => {
    try {
      const { date } = req.body;
      const targetDate = date || new Date().toISOString().split("T")[0];
      const snapshot = await storage.calculateDailyKpiSnapshot(req.params.staffId, targetDate);
      res.status(201).json(snapshot);
    } catch (err: any) {
      console.error("Error calculating daily snapshot:", err);
      res.status(500).json({ message: "Failed to calculate daily snapshot" });
    }
  });

  // KPI Targets
  app.get("/api/kpi/targets", isAuthenticated, async (req, res) => {
    try {
      const targets = await storage.getKpiTargets();
      res.json(targets);
    } catch (err: any) {
      console.error("Error fetching KPI targets:", err);
      res.status(500).json({ message: "Failed to fetch KPI targets" });
    }
  });

  app.get("/api/kpi/targets/:teamConfig", isAuthenticated, async (req, res) => {
    try {
      const target = await storage.getKpiTargetByConfig(req.params.teamConfig);
      if (!target) {
        return res.status(404).json({ message: "Target configuration not found" });
      }
      res.json(target);
    } catch (err: any) {
      console.error("Error fetching KPI target:", err);
      res.status(500).json({ message: "Failed to fetch KPI target" });
    }
  });

  // KPI Alerts
  app.get("/api/kpi/alerts", isAuthenticated, async (req, res) => {
    try {
      const { acknowledged } = req.query;
      const ack = acknowledged === "true" ? true : acknowledged === "false" ? false : undefined;
      const alerts = await storage.getKpiAlerts(ack);
      res.json(alerts);
    } catch (err: any) {
      console.error("Error fetching KPI alerts:", err);
      res.status(500).json({ message: "Failed to fetch KPI alerts" });
    }
  });

  app.get("/api/kpi/alerts/staff/:staffId", isAuthenticated, async (req, res) => {
    try {
      const alerts = await storage.getKpiAlertsByStaff(req.params.staffId);
      res.json(alerts);
    } catch (err: any) {
      console.error("Error fetching staff KPI alerts:", err);
      res.status(500).json({ message: "Failed to fetch staff KPI alerts" });
    }
  });

  app.post("/api/kpi/alerts/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const alert = await storage.acknowledgeKpiAlert(req.params.id, userId);
      if (!alert) {
        return res.status(404).json({ message: "Alert not found" });
      }
      res.json(alert);
    } catch (err: any) {
      console.error("Error acknowledging alert:", err);
      res.status(500).json({ message: "Failed to acknowledge alert" });
    }
  });

  // Bonus Periods
  app.get("/api/kpi/bonus", isAuthenticated, async (req, res) => {
    try {
      const { staffId } = req.query;
      const periods = await storage.getBonusPeriods(staffId as string);
      res.json(periods);
    } catch (err: any) {
      console.error("Error fetching bonus periods:", err);
      res.status(500).json({ message: "Failed to fetch bonus periods" });
    }
  });

  app.get("/api/kpi/bonus/current/:staffId", isAuthenticated, async (req, res) => {
    try {
      const period = await storage.getCurrentBonusPeriod(req.params.staffId);
      if (!period) {
        return res.status(404).json({ message: "No current bonus period" });
      }
      res.json(period);
    } catch (err: any) {
      console.error("Error fetching current bonus period:", err);
      res.status(500).json({ message: "Failed to fetch current bonus period" });
    }
  });

  app.post("/api/kpi/bonus/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const period = await storage.approveBonusPeriod(req.params.id, userId);
      if (!period) {
        return res.status(404).json({ message: "Bonus period not found" });
      }
      res.json(period);
    } catch (err: any) {
      console.error("Error approving bonus:", err);
      res.status(500).json({ message: "Failed to approve bonus" });
    }
  });

  app.post("/api/kpi/bonus/:id/pay", isAuthenticated, async (req, res) => {
    try {
      const period = await storage.markBonusPeriodPaid(req.params.id);
      if (!period) {
        return res.status(404).json({ message: "Bonus period not found" });
      }
      res.json(period);
    } catch (err: any) {
      console.error("Error marking bonus paid:", err);
      res.status(500).json({ message: "Failed to mark bonus paid" });
    }
  });

  // Sales Phase Progression
  app.get("/api/kpi/staff/:staffId/phase-log", isAuthenticated, async (req, res) => {
    try {
      const log = await storage.getPhaseLog(req.params.staffId);
      res.json(log);
    } catch (err: any) {
      console.error("Error fetching phase log:", err);
      res.status(500).json({ message: "Failed to fetch phase log" });
    }
  });

  app.post("/api/kpi/staff/:staffId/advance-phase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { notes } = req.body;
      await storage.advanceSalesPhase(req.params.staffId, userId, notes);
      res.json({ success: true, message: "Sales phase advanced successfully" });
    } catch (err: any) {
      console.error("Error advancing sales phase:", err);
      res.status(500).json({ message: err.message || "Failed to advance sales phase" });
    }
  });

  // Phase Checklist
  app.get("/api/kpi/staff/:staffId/phase-checklist", isAuthenticated, async (req, res) => {
    try {
      const { fromPhase, toPhase } = req.query;
      const from = parseInt(fromPhase as string) || 1;
      const to = parseInt(toPhase as string) || 2;
      const checklist = await storage.getPhaseChecklist(req.params.staffId, from, to);
      res.json(checklist);
    } catch (err: any) {
      console.error("Error fetching phase checklist:", err);
      res.status(500).json({ message: "Failed to fetch phase checklist" });
    }
  });

  app.post("/api/kpi/phase-checklist/:id/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const item = await storage.togglePhaseChecklistItem(req.params.id, userId);
      if (!item) {
        return res.status(404).json({ message: "Checklist item not found" });
      }
      res.json(item);
    } catch (err: any) {
      console.error("Error toggling checklist item:", err);
      res.status(500).json({ message: "Failed to toggle checklist item" });
    }
  });

  // =====================
  // CLIENT PORTAL - CLIENT MANAGEMENT (Staff Side)
  // =====================

  // Get all clients for the organization
  app.get("/api/clients", isAuthenticated, withOrganization, async (req: any, res) => {
    try {
      const organizationId = req.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "Organization context required. Please set up your organization first." });
      }
      const clientList = await storage.getClients(organizationId);
      res.json(clientList);
    } catch (err: any) {
      console.error("Error fetching clients:", err);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  // Get single client
  app.get("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (err: any) {
      console.error("Error fetching client:", err);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  // Create client
  app.post("/api/clients", isAuthenticated, withOrganization, async (req: any, res) => {
    try {
      const organizationId = req.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "Organization context required. Please set up your organization first." });
      }
      
      const parsed = insertClientSchema.safeParse({ ...req.body, organizationId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid client data", errors: parsed.error.issues });
      }
      
      const client = await storage.createClient(parsed.data);
      res.status(201).json(client);
    } catch (err: any) {
      console.error("Error creating client:", err);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // Update client
  app.patch("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateClient(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating client:", err);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  // Delete client
  app.delete("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting client:", err);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Enable/disable portal access for a client
  app.post("/api/clients/:id/portal-access", isAuthenticated, async (req, res) => {
    try {
      const { enabled } = req.body;
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // If enabling, ensure client has an email and create portal account if needed
      if (enabled) {
        if (!client.email) {
          return res.status(400).json({ message: "Client must have an email to enable portal access" });
        }
        
        // Check if portal account exists
        let portalAccount = await storage.getClientPortalAccountByClientId(client.id);
        if (!portalAccount) {
          portalAccount = await storage.createClientPortalAccount({
            clientId: client.id,
            email: client.email,
          });
        }
      }

      const updated = await storage.updateClient(req.params.id, { portalEnabled: enabled });
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating portal access:", err);
      res.status(500).json({ message: "Failed to update portal access" });
    }
  });

  // =====================
  // CLIENT PORTAL - JOB MILESTONES
  // =====================

  // Get milestones for a job
  app.get("/api/jobs/:jobId/milestones", isAuthenticated, async (req, res) => {
    try {
      const milestones = await storage.getJobMilestones(req.params.jobId);
      res.json(milestones);
    } catch (err: any) {
      console.error("Error fetching milestones:", err);
      res.status(500).json({ message: "Failed to fetch milestones" });
    }
  });

  // Get milestone with details
  app.get("/api/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const milestone = await storage.getMilestoneWithDetails(req.params.id);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      res.json(milestone);
    } catch (err: any) {
      console.error("Error fetching milestone:", err);
      res.status(500).json({ message: "Failed to fetch milestone" });
    }
  });

  // Create milestone
  app.post("/api/jobs/:jobId/milestones", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertJobMilestoneSchema.safeParse({ ...req.body, jobId: req.params.jobId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid milestone data", errors: parsed.error.issues });
      }
      
      const milestone = await storage.createMilestone(parsed.data);
      res.status(201).json(milestone);
    } catch (err: any) {
      console.error("Error creating milestone:", err);
      res.status(500).json({ message: "Failed to create milestone" });
    }
  });

  // Update milestone
  app.patch("/api/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateMilestone(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating milestone:", err);
      res.status(500).json({ message: "Failed to update milestone" });
    }
  });

  // Complete milestone
  app.post("/api/milestones/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      
      const updated = await storage.completeMilestone(req.params.id, staffProfile?.id || userId);
      if (!updated) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error completing milestone:", err);
      res.status(500).json({ message: "Failed to complete milestone" });
    }
  });

  // Delete milestone
  app.delete("/api/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteMilestone(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting milestone:", err);
      res.status(500).json({ message: "Failed to delete milestone" });
    }
  });

  // =====================
  // CLIENT PORTAL - MILESTONE PAYMENTS
  // =====================

  // Get payments for a milestone
  app.get("/api/milestones/:milestoneId/payments", isAuthenticated, async (req, res) => {
    try {
      const payments = await storage.getMilestonePayments(req.params.milestoneId);
      res.json(payments);
    } catch (err: any) {
      console.error("Error fetching payments:", err);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // Get pending payments for a job
  app.get("/api/jobs/:jobId/pending-payments", isAuthenticated, async (req, res) => {
    try {
      const payments = await storage.getPendingPaymentsByJob(req.params.jobId);
      res.json(payments);
    } catch (err: any) {
      console.error("Error fetching pending payments:", err);
      res.status(500).json({ message: "Failed to fetch pending payments" });
    }
  });

  // Create milestone payment
  app.post("/api/milestones/:milestoneId/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      
      const parsed = insertMilestonePaymentSchema.safeParse({
        ...req.body,
        milestoneId: req.params.milestoneId,
        requestedAt: new Date(),
        requestedById: staffProfile?.id,
      });
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payment data", errors: parsed.error.issues });
      }
      
      const payment = await storage.createMilestonePayment(parsed.data);
      res.status(201).json(payment);
    } catch (err: any) {
      console.error("Error creating payment:", err);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  // Update milestone payment
  app.patch("/api/milestone-payments/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateMilestonePayment(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating payment:", err);
      res.status(500).json({ message: "Failed to update payment" });
    }
  });

  // Record payment as paid (staff marks payment received)
  app.post("/api/milestone-payments/:id/paid", isAuthenticated, async (req, res) => {
    try {
      const { paymentMethod, paymentReference } = req.body;
      const updated = await storage.recordMilestonePaymentPaid(req.params.id, paymentMethod, paymentReference);
      if (!updated) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error recording payment:", err);
      res.status(500).json({ message: "Failed to record payment" });
    }
  });

  // =====================
  // CLIENT PORTAL - MILESTONE MEDIA
  // =====================

  // Get media for a milestone
  app.get("/api/milestones/:milestoneId/media", isAuthenticated, async (req, res) => {
    try {
      const media = await storage.getMilestoneMedia(req.params.milestoneId);
      res.json(media);
    } catch (err: any) {
      console.error("Error fetching media:", err);
      res.status(500).json({ message: "Failed to fetch media" });
    }
  });

  // Get all media for a job
  app.get("/api/jobs/:jobId/media", isAuthenticated, async (req, res) => {
    try {
      const media = await storage.getJobMedia(req.params.jobId);
      res.json(media);
    } catch (err: any) {
      console.error("Error fetching job media:", err);
      res.status(500).json({ message: "Failed to fetch job media" });
    }
  });

  // Create milestone media (photo or note)
  app.post("/api/milestones/:milestoneId/media", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const staffProfile = await storage.getStaffProfileByUserId(userId);
      
      // Get the milestone to find the jobId
      const milestone = await storage.getMilestone(req.params.milestoneId);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      
      const parsed = insertMilestoneMediaSchema.safeParse({
        ...req.body,
        milestoneId: req.params.milestoneId,
        jobId: milestone.jobId,
        uploadedById: staffProfile?.id,
        workDate: req.body.workDate || new Date().toISOString().split('T')[0],
      });
      
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid media data", errors: parsed.error.issues });
      }
      
      const media = await storage.createMilestoneMedia(parsed.data);
      res.status(201).json(media);
    } catch (err: any) {
      console.error("Error creating media:", err);
      res.status(500).json({ message: "Failed to create media" });
    }
  });

  // Update media visibility
  app.patch("/api/milestone-media/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateMilestoneMedia(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Media not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating media:", err);
      res.status(500).json({ message: "Failed to update media" });
    }
  });

  // Delete media
  app.delete("/api/milestone-media/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteMilestoneMedia(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting media:", err);
      res.status(500).json({ message: "Failed to delete media" });
    }
  });

  // =====================
  // CLIENT PORTAL - CLIENT AUTHENTICATION
  // =====================

  // Client portal login - request OTP
  app.post("/api/client-portal/auth/request-otp", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if client portal account exists
      const portalAccount = await storage.getClientPortalAccountByEmail(email);
      if (!portalAccount) {
        // Don't reveal if account exists for security
        console.log(`Client portal OTP requested for unknown email: ${email}`);
        return res.json({ success: true, message: "If this email is registered, you will receive a login code" });
      }

      // Check if portal access is enabled
      const client = await storage.getClient(portalAccount.clientId);
      if (!client?.portalEnabled) {
        console.log(`Client portal OTP requested for disabled portal: ${email}`);
        return res.json({ success: true, message: "If this email is registered, you will receive a login code" });
      }

      // Create verification code
      const verificationCode = await storage.createClientPortalVerificationCode(
        portalAccount.id,
        email,
        "login"
      );

      // Log the code (in production, this would be sent via email/SMS)
      console.log(`[CLIENT PORTAL] OTP code for ${email}: ${verificationCode.code}`);

      res.json({ success: true, message: "If this email is registered, you will receive a login code" });
    } catch (err: any) {
      console.error("Error requesting client portal OTP:", err);
      res.status(500).json({ message: "Failed to request login code" });
    }
  });

  // Client portal login - verify OTP
  app.post("/api/client-portal/auth/verify-otp", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }

      // Verify the code
      const verification = await storage.verifyClientPortalCode(email, code, "login");
      if (!verification) {
        return res.status(401).json({ message: "Invalid or expired code" });
      }

      // Get portal account
      const portalAccount = await storage.getClientPortalAccountByEmail(email);
      if (!portalAccount) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Get client
      const client = await storage.getClient(portalAccount.clientId);
      if (!client?.portalEnabled) {
        return res.status(403).json({ message: "Portal access is not enabled" });
      }

      // Update last login
      await storage.updateClientPortalAccount(portalAccount.id, {
        isVerified: true,
        lastLoginAt: new Date(),
      });

      // Create signed session token with server-side session tracking
      const userAgent = req.headers['user-agent'] || undefined;
      const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || undefined;
      const { token } = await createClientPortalToken({
        clientId: client.id,
        portalAccountId: portalAccount.id,
        email: client.email || email,
      }, userAgent, ipAddress);

      res.json({
        success: true,
        token,
        client: {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          portalAccountId: portalAccount.id,
        },
      });
    } catch (err: any) {
      console.error("Error verifying client portal OTP:", err);
      res.status(500).json({ message: "Failed to verify login code" });
    }
  });

  // =====================
  // CLIENT PORTAL - CLIENT-FACING API (Protected by token authentication)
  // =====================

  // Get client's jobs (for portal view)
  app.get("/api/client-portal/jobs", clientPortalAuth, async (req: ClientPortalRequest, res) => {
    try {
      const clientId = req.clientPortal!.clientId;

      const client = await storage.getClient(clientId);
      if (!client?.portalEnabled) {
        return res.status(403).json({ message: "Portal access not enabled" });
      }

      const jobs = await storage.getClientJobsForPortal(clientId);
      res.json(jobs);
    } catch (err: any) {
      console.error("Error fetching client portal jobs:", err);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  // Get job timeline with milestones (for portal view)
  app.get("/api/client-portal/jobs/:jobId/timeline", clientPortalAuth, async (req: ClientPortalRequest, res) => {
    try {
      const clientId = req.clientPortal!.clientId;

      // Verify job belongs to client
      const job = await storage.getJob(req.params.jobId);
      if (!job || job.clientId !== clientId) {
        return res.status(404).json({ message: "Job not found" });
      }

      const milestones = await storage.getJobMilestonesForPortal(req.params.jobId);
      
      // Format timeline data
      const timeline = milestones.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        status: m.status,
        progressPercent: m.progressPercent,
        scheduledStartDate: m.scheduledStartDate,
        scheduledEndDate: m.scheduledEndDate,
        completedAt: m.completedAt,
        payments: m.payments,
        mediaCount: m.media.length,
        recentMedia: m.media.slice(0, 4),
      }));

      res.json({ job, timeline });
    } catch (err: any) {
      console.error("Error fetching client portal timeline:", err);
      res.status(500).json({ message: "Failed to fetch timeline" });
    }
  });

  // Client approves a payment request
  app.post("/api/client-portal/payments/:id/approve", clientPortalAuth, async (req: ClientPortalRequest, res) => {
    try {
      const clientId = req.clientPortal!.clientId;

      // Verify payment belongs to client's job
      const payment = await storage.getMilestonePayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const milestone = await storage.getMilestone(payment.milestoneId);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }

      const job = await storage.getJob(milestone.jobId);
      if (!job || job.clientId !== clientId) {
        return res.status(403).json({ message: "Not authorized to approve this payment" });
      }

      const updated = await storage.approveMilestonePayment(req.params.id);
      res.json(updated);
    } catch (err: any) {
      console.error("Error approving payment:", err);
      res.status(500).json({ message: "Failed to approve payment" });
    }
  });

  // Client logout - revoke session
  app.post("/api/client-portal/auth/logout", clientPortalAuth, async (req: ClientPortalRequest, res) => {
    try {
      await storage.revokePortalSession(req.clientPortal!.sessionId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error logging out:", err);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  // =====================
  // CLIENT PORTAL QUOTE APPROVAL
  // =====================

  // Get quotes for client
  app.get("/api/client-portal/quotes", clientPortalAuth, async (req: ClientPortalRequest, res) => {
    try {
      const clientId = req.clientPortal!.clientId;
      const quotes = await storage.getQuotesByClient(clientId);
      res.json(quotes);
    } catch (err: any) {
      console.error("Error fetching client quotes:", err);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  // Get single quote for client (with line items and payment schedules)
  app.get("/api/client-portal/quotes/:id", clientPortalAuth, async (req: ClientPortalRequest, res) => {
    try {
      const clientId = req.clientPortal!.clientId;
      const quote = await storage.getQuote(req.params.id);
      
      if (!quote || quote.clientId !== clientId) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const lineItems = await storage.getLineItemsByQuote(quote.id);
      const paymentSchedules = await storage.getQuotePaymentSchedules(quote.id);
      const workflowEvents = await storage.getQuoteWorkflowEvents(quote.id);

      res.json({ ...quote, lineItems, paymentSchedules, workflowEvents });
    } catch (err: any) {
      console.error("Error fetching quote:", err);
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  // Approve quote
  app.post("/api/client-portal/quotes/:id/approve", clientPortalAuth, async (req: ClientPortalRequest, res) => {
    try {
      const clientId = req.clientPortal!.clientId;
      const quote = await storage.getQuote(req.params.id);
      
      if (!quote || quote.clientId !== clientId) {
        return res.status(404).json({ message: "Quote not found" });
      }

      if (quote.clientStatus !== "pending") {
        return res.status(400).json({ message: "Quote is not pending approval" });
      }

      // Update quote status
      const updated = await storage.updateQuote(req.params.id, {
        clientStatus: "approved",
        approvedAt: new Date(),
        approvedByClientId: clientId,
        status: "accepted",
      });

      // Log workflow event
      await storage.createQuoteWorkflowEvent({
        quoteId: req.params.id,
        action: "approved",
        actorType: "client",
        actorId: clientId,
        notes: req.body.notes || null,
      });

      // Check for auto-convert setting and trigger if enabled
      if (quote.organizationId) {
        const settings = await storage.getOrganizationSettings(quote.organizationId);
        if (settings?.autoConvertApprovedQuotes) {
          try {
            // Auto-convert quote to invoice
            const invoice = await storage.createInvoiceFromQuote(req.params.id, "system");
            
            if (invoice) {
              await storage.createQuoteWorkflowEvent({
                quoteId: req.params.id,
                action: "auto_converted_to_invoice",
                actorType: "system",
                actorId: "system",
                notes: `Invoice ${invoice.invoiceNumber} created automatically`,
              });

              // Auto-create job from approved quote
              const convertResult = await storage.convertQuoteToJob(req.params.id);
              if (convertResult) {
                await storage.createQuoteWorkflowEvent({
                  quoteId: req.params.id,
                  action: "auto_converted_to_job",
                  actorType: "system",
                  actorId: "system",
                  notes: `Job created automatically`,
                });

                // Link invoice to the job
                await storage.updateInvoice(invoice.id, {
                  jobId: convertResult.job.id,
                });
              }
            }
          } catch (convertError: any) {
            console.error("Auto-conversion error:", convertError);
            await storage.createQuoteWorkflowEvent({
              quoteId: req.params.id,
              action: "auto_convert_failed",
              actorType: "system",
              actorId: "system",
              notes: convertError.message || "Auto-conversion failed",
            });
          }
        }
      }

      res.json(updated);
    } catch (err: any) {
      console.error("Error approving quote:", err);
      res.status(500).json({ message: "Failed to approve quote" });
    }
  });

  // Reject quote
  app.post("/api/client-portal/quotes/:id/reject", clientPortalAuth, async (req: ClientPortalRequest, res) => {
    try {
      const clientId = req.clientPortal!.clientId;
      const quote = await storage.getQuote(req.params.id);
      
      if (!quote || quote.clientId !== clientId) {
        return res.status(404).json({ message: "Quote not found" });
      }

      if (quote.clientStatus !== "pending") {
        return res.status(400).json({ message: "Quote is not pending approval" });
      }

      const updated = await storage.updateQuote(req.params.id, {
        clientStatus: "rejected",
        status: "rejected",
      });

      await storage.createQuoteWorkflowEvent({
        quoteId: req.params.id,
        action: "rejected",
        actorType: "client",
        actorId: clientId,
        notes: req.body.reason || null,
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Error rejecting quote:", err);
      res.status(500).json({ message: "Failed to reject quote" });
    }
  });

  // Request changes to quote
  app.post("/api/client-portal/quotes/:id/request-changes", clientPortalAuth, async (req: ClientPortalRequest, res) => {
    try {
      const clientId = req.clientPortal!.clientId;
      const quote = await storage.getQuote(req.params.id);
      
      if (!quote || quote.clientId !== clientId) {
        return res.status(404).json({ message: "Quote not found" });
      }

      if (quote.clientStatus !== "pending") {
        return res.status(400).json({ message: "Quote is not pending approval" });
      }

      const updated = await storage.updateQuote(req.params.id, {
        clientStatus: "changes_requested",
        status: "draft",
      });

      await storage.createQuoteWorkflowEvent({
        quoteId: req.params.id,
        action: "changes_requested",
        actorType: "client",
        actorId: clientId,
        notes: req.body.changes || null,
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Error requesting changes:", err);
      res.status(500).json({ message: "Failed to request changes" });
    }
  });

  // =====================
  // PUBLIC PAYMENT ENDPOINTS (no auth required)
  // =====================

  // Get invoice by payment link token (public - for clients to view and pay)
  app.get("/api/pay/:token", async (req, res) => {
    try {
      const invoice = await storage.getInvoiceByPaymentToken(req.params.token);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found or payment link expired" });
      }
      
      // Get payment schedules linked to this invoice
      const paymentSchedules = invoice.quoteId 
        ? await storage.getQuotePaymentSchedules(invoice.quoteId)
        : [];
      
      // Return invoice with payment schedules
      res.json({
        ...invoice,
        paymentSchedules: paymentSchedules.filter(s => s.invoiceId === invoice.id),
      });
    } catch (err: any) {
      console.error("Error fetching invoice by payment token:", err);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  // Record a payment against an invoice (public - for client deposit payments)
  app.post("/api/pay/:token/payment", async (req, res) => {
    try {
      const invoice = await storage.getInvoiceByPaymentToken(req.params.token);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found or payment link expired" });
      }

      const { amount, paymentMethod, reference } = req.body;
      if (!amount) {
        return res.status(400).json({ message: "Payment amount is required" });
      }

      const paymentAmount = parseFloat(amount);
      const currentAmountDue = parseFloat(invoice.amountDue || "0");
      
      // Validate payment amount doesn't exceed amount due
      if (paymentAmount <= 0) {
        return res.status(400).json({ message: "Payment amount must be positive" });
      }
      if (paymentAmount > currentAmountDue) {
        return res.status(400).json({ message: "Payment amount exceeds balance due" });
      }

      // Create invoice payment record
      const payment = await storage.createInvoicePayment({
        invoiceId: invoice.id,
        amount: String(paymentAmount.toFixed(2)),
        paymentMethod: paymentMethod || "online",
        reference: reference || `PAY-${Date.now()}`,
        status: "completed",
      });

      // Update invoice amount due
      const newAmountDue = Math.max(0, currentAmountDue - paymentAmount);
      const newStatus = newAmountDue === 0 ? "paid" : "partial";
      
      await storage.updateInvoice(invoice.id, {
        amountDue: String(newAmountDue.toFixed(2)),
        status: newStatus,
      });

      // Mark the deposit payment schedule as paid if this was a deposit payment
      if (invoice.quoteId) {
        const schedules = await storage.getQuotePaymentSchedules(invoice.quoteId);
        const depositSchedule = schedules.find(s => 
          s.type === "deposit" && 
          !s.isPaid && 
          s.invoiceId === invoice.id
        );
        if (depositSchedule) {
          const depositAmount = parseFloat(depositSchedule.calculatedAmount || "0");
          // Only mark as paid if payment covers the deposit
          if (paymentAmount >= depositAmount) {
            await storage.markPaymentSchedulePaid(depositSchedule.id, String(paymentAmount.toFixed(2)));
          }
        }
      }

      res.json({ success: true, payment, newAmountDue: newAmountDue.toFixed(2) });
    } catch (err: any) {
      console.error("Error recording payment:", err);
      res.status(500).json({ message: "Failed to record payment" });
    }
  });

  return httpServer;
}
