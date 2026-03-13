import type { Express } from "express";
import crypto from "crypto";
import {
  storage,
  isAuthenticated,
  getUserId,
  authStorage,
  generateOTPCode,
} from "../../routes/shared";
import type { Role } from "@shared/schema";
import { userPermissions, employmentTypes, type UserPermission } from "@shared/schema";
import { sendOtpEmail, sendPasswordResetEmail, sendUserInviteEmail } from "../../email";
import { generatePresignedUploadUrl } from "../storage/service";
import { isR2Configured } from "../../env";

async function getReplitFallbackUploadUrl(): Promise<{
  uploadURL: string;
  objectPath: string;
} | null> {
  try {
    const { ObjectStorageService } = await import(
      "../../replit_integrations/object_storage"
    );
    const svc = new ObjectStorageService();
    const uploadURL = await svc.getObjectEntityUploadURL();
    const objectPath = svc.normalizeObjectEntityPath(uploadURL);
    return { uploadURL, objectPath };
  } catch {
    return null;
  }
}

const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function registerAuthRoutes(app: Express): void {
  // Request OTP code (email or phone)
  app.post("/api/auth/otp/request", async (req, res) => {
    try {
      const { email, phone } = req.body;

      if (!email && !phone) {
        return res.status(400).json({ message: "Email or phone is required" });
      }

      const code = generateOTPCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await storage.createVerificationCode({
        email: email?.toLowerCase(),
        phone,
        code,
        purpose: "login",
        expiresAt,
      });

      if (email) {
        try {
          await sendOtpEmail(email, code);
        } catch (e) {
          console.error("Failed to send OTP email:", e);
        }
      }
      console.log(`OTP Code for ${email || phone}: ${code}`);

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

      await storage.markVerificationCodeUsed(verification.id);

      const identifier = email || phone;
      const identityType = email ? "email" : "phone";
      let identity = await storage.getAuthIdentityByIdentifier(identityType, identifier);

      if (!identity) {
        const newUserId = `${identityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        identity = await storage.createAuthIdentity({
          userId: newUserId,
          type: identityType,
          identifier,
          isVerified: true,
          isPrimary: true,
        });
        await authStorage.upsertUser({
          id: newUserId,
          ...(identityType === "email" ? { email: identifier } : {}),
        });
      } else {
        await storage.updateAuthIdentity(identity.id, {
          lastUsedAt: new Date(),
          isVerified: true,
        });
        await authStorage.upsertUser({
          id: identity.userId,
          ...(identityType === "email" ? { email: identifier } : {}),
        });
      }

      if (req.session) {
        req.session.userId = identity.userId;
        req.session.authType = identityType;
        req.session.isAuthenticated = true;
      }

      res.json({
        message: "Login successful",
        userId: identity.userId,
        memberships: [],
      });
    } catch (err: any) {
      console.error("Error verifying OTP:", err);
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  app.get("/api/auth/session", async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (req.session?.isAuthenticated && userId) {
        const identities = await storage.getAuthIdentities(userId);

        return res.json({
          isAuthenticated: true,
          authType: req.session.authType,
          userId,
          memberships: [],
          identities: identities.map((i: any) => ({
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

  // Register with email/password – disabled in production; registration is by invite only.
  // In test env (NODE_ENV=test), allow registration so API tests can create a user and obtain a session.
  app.post("/api/auth/register", async (req: any, res) => {
    if (process.env.NODE_ENV !== "test") {
      return res.status(410).json({ message: "Registration is by invite only." });
    }
    try {
      const { email, password } = req.body;
      if (!email || !password || typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const normalized = email.toLowerCase().trim();
      const existing = await storage.getAuthIdentityByIdentifier("email", normalized);
      if (existing) {
        return res.status(400).json({ message: "Email is already registered" });
      }
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 12);
      const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      await authStorage.upsertUser({ id: userId, email: normalized });
      await storage.createAuthIdentity({
        userId,
        type: "email",
        identifier: normalized,
        passwordHash,
        isVerified: true,
        isPrimary: true,
      });
      if (req.session) {
        req.session.userId = userId;
        req.session.authType = "email";
        req.session.isAuthenticated = true;
      }
      return res.status(201).json({ message: "Registration successful", userId });
    } catch (err: any) {
      console.error("Error in test registration:", err);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

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

      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(password, identity.passwordHash);

      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      await storage.updateAuthIdentity(identity.id, {
        lastUsedAt: new Date(),
      });

      if (req.session) {
        req.session.userId = identity.userId;
        req.session.authType = "email";
        req.session.isAuthenticated = true;
      }

      await authStorage.upsertUser({
        id: identity.userId,
        email: identity.identifier,
      });

      res.json({
        message: "Login successful",
        userId: identity.userId,
        isVerified: identity.isVerified,
        memberships: [],
      });
    } catch (err: any) {
      console.error("Error logging in:", err);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  app.post("/api/auth/verify-email", async (req: any, res) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }

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

      await storage.markVerificationCodeUsed(verification.id);

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

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const identity = await storage.getAuthIdentityByIdentifier("email", email.toLowerCase());

      if (identity && identity.passwordHash) {
        const code = generateOTPCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await storage.createVerificationCode({
          email: email.toLowerCase(),
          code,
          purpose: "password_reset",
          expiresAt,
        });

        try {
          await sendPasswordResetEmail(email, code);
        } catch (e) {
          console.error("Failed to send password reset email:", e);
        }
        console.log(`Password reset code for ${email}: ${code}`);
      }

      res.json({
        message: "If this email exists, a password reset code will be sent.",
      });
    } catch (err: any) {
      console.error("Error requesting password reset:", err);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;

      if (!email || !code || !newPassword) {
        return res.status(400).json({ message: "Email, code, and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

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

      await storage.markVerificationCodeUsed(verification.id);

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

  app.post("/api/auth/change-password", async (req: any, res) => {
    try {
      const userId = getUserId(req);
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

      const identities = await storage.getAuthIdentities(userId);
      const emailIdentity = identities.find((i) => i.type === "email" && i.passwordHash);

      if (!emailIdentity) {
        return res.status(400).json({ message: "No password-based login found for this account" });
      }

      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(currentPassword, emailIdentity.passwordHash!);

      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

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

  app.post("/api/auth/set-password", async (req: any, res) => {
    try {
      const userId = getUserId(req);
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

  // Request presigned URL for profile image upload (authenticated user)
  app.post("/api/auth/user/request-upload", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const body = req.body as Record<string, unknown>;
      const filename = (body.filename ?? body.name) as string | undefined;
      const contentType = (body.contentType ?? body.content_type) as string | undefined;
      const size = typeof body.size === "number" ? body.size : Number(body.size);
      if (!filename || typeof filename !== "string" || filename.length > 255) {
        return res.status(400).json({ error: "Missing or invalid filename" });
      }
      if (!contentType || !PROFILE_IMAGE_TYPES.includes(contentType as (typeof PROFILE_IMAGE_TYPES)[number])) {
        return res.status(400).json({ error: "Invalid file type. Use JPEG, PNG, or WebP." });
      }
      const sz = Number.isNaN(size) ? 0 : size;
      if (sz <= 0 || sz > PROFILE_IMAGE_MAX_BYTES) {
        return res.status(400).json({ error: "File size must be between 1 byte and 5MB" });
      }
      if (isR2Configured()) {
        const result = await generatePresignedUploadUrl({ filename, contentType, size: sz });
        if (!result) {
          return res.status(503).json({ error: "Failed to generate upload URL" });
        }
        return res.json({
          uploadURL: result.uploadUrl,
          uploadUrl: result.uploadUrl,
          objectPath: result.objectPath,
        });
      }
      const fallback = await getReplitFallbackUploadUrl();
      if (!fallback) {
        return res.status(503).json({
          error: "Storage not configured. Set R2_* env vars or use Replit object storage.",
        });
      }
      return res.json({
        uploadURL: fallback.uploadURL,
        uploadUrl: fallback.uploadURL,
        objectPath: fallback.objectPath,
      });
    } catch (err: any) {
      console.error("Error requesting profile upload URL:", err);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Update current user profile (firstName, lastName, profileImageUrl)
  app.patch("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { firstName, lastName, profileImageUrl } = req.body;
      const rawFirst = typeof firstName === "string" ? firstName.trim() : "";
      const rawLast = typeof lastName === "string" ? lastName.trim() : "";
      if (!rawFirst || !rawLast) {
        return res.status(400).json({ message: "First name and last name are required" });
      }
      const maxLen = 100;
      const first = rawFirst.length > maxLen ? rawFirst.slice(0, maxLen) : rawFirst;
      const last = rawLast.length > maxLen ? rawLast.slice(0, maxLen) : rawLast;
      const profileUrl =
        profileImageUrl === undefined
          ? undefined
          : typeof profileImageUrl === "string"
            ? profileImageUrl.trim() || null
            : null;

      const update: { id: string; firstName: string; lastName: string; profileImageUrl?: string | null } = {
        id: userId,
        firstName: first,
        lastName: last,
      };
      if (profileImageUrl !== undefined) {
        update.profileImageUrl = profileUrl;
      }
      await authStorage.upsertUser(update);
      return res.json({ message: "Profile updated" });
    } catch (err: any) {
      console.error("Error updating profile:", err);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/auth/is-super-admin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.json({ isSuperAdmin: false });
      }
      const profile = await storage.getStaffProfileByUserId(userId);
      const isSuperAdmin = !!(
        profile &&
        (profile.roles?.includes("admin") || profile.permissions?.includes("admin_settings"))
      );
      res.json({ isSuperAdmin });
    } catch (err) {
      console.error("Error checking super-admin:", err);
      res.json({ isSuperAdmin: false });
    }
  });

  async function isSuperAdmin(req: any): Promise<boolean> {
    const userId = getUserId(req);
    if (!userId) return false;
    const profile = await storage.getStaffProfileByUserId(userId);
    return !!(
      profile &&
      (profile.roles?.includes("admin") || profile.permissions?.includes("admin_settings"))
    );
  }

  const INVITE_EXPIRY_DAYS = 7;

  app.post("/api/invites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!(await isSuperAdmin(req))) {
        return res.status(403).json({ message: "Only an admin can invite users" });
      }

      const {
        email,
        roleId: rawRoleId,
        roleIds: rawRoleIds,
        firstName: rawFirstName,
        lastName: rawLastName,
        profileImageUrl: rawProfileImageUrl,
        permissions: rawPermissions,
        employmentType: rawEmploymentType,
        salaryType: rawSalaryType,
        salaryAmount: rawSalaryAmount,
        overtimeRateMultiplier: rawOvertimeMultiplier,
        overtimeThresholdHours: rawOvertimeThreshold,
        emailSignature: rawEmailSignature,
        timezone: rawTimezone,
        lunchBreakMinutes: rawLunchBreakMinutes,
        lunchBreakPaid: rawLunchBreakPaid,
        workingHours: rawWorkingHours,
      } = req.body;
      const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!normalized || !emailRegex.test(normalized)) {
        return res.status(400).json({ message: "Invalid email" });
      }

      const rawFirst = typeof rawFirstName === "string" ? rawFirstName.trim() : "";
      const rawLast = typeof rawLastName === "string" ? rawLastName.trim() : "";
      if (!rawFirst || !rawLast) {
        return res.status(400).json({ message: "First name and last name are required" });
      }
      const maxLen = 100;
      const firstName = rawFirst.length > maxLen ? rawFirst.slice(0, maxLen) : rawFirst;
      const lastName = rawLast.length > maxLen ? rawLast.slice(0, maxLen) : rawLast;
      const profileImageUrl = typeof rawProfileImageUrl === "string" ? rawProfileImageUrl.trim() || null : null;

      const roleId = typeof rawRoleId === "string" ? rawRoleId.trim() : undefined;
      const roleIdsArr = Array.isArray(rawRoleIds)
        ? rawRoleIds.filter((r: unknown) => typeof r === "string").map((r: string) => r.trim())
        : roleId
          ? [roleId]
          : [];
      const resolvedRoles: Role[] = [];
      for (const rid of roleIdsArr) {
        const r = await storage.getRole(rid);
        if (r) resolvedRoles.push(r);
      }
      const role = resolvedRoles[0];
      const roleNames = resolvedRoles.map((r) => r.name);

      const existingIdentity = await storage.getAuthIdentityByIdentifier("email", normalized);
      if (existingIdentity) {
        return res.status(400).json({ message: "Email is already registered" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const invitePerms = Array.isArray(rawPermissions) ? rawPermissions.filter((p: unknown) => typeof p === "string") : [];
      const validPerms = invitePerms.filter((p: string) => userPermissions.includes(p as any));

      const staffConfig: Record<string, unknown> = {};
      if (roleNames.length > 0) staffConfig.roles = roleNames;
      if (employmentTypes.includes(rawEmploymentType as any)) staffConfig.employmentType = rawEmploymentType;
      if (rawSalaryType === "hourly" || rawSalaryType === "annual") staffConfig.salaryType = rawSalaryType;
      if (typeof rawSalaryAmount === "string" && rawSalaryAmount.trim()) staffConfig.salaryAmount = rawSalaryAmount.trim();
      if (["1.25", "1.5", "1.75", "2"].includes(String(rawOvertimeMultiplier))) staffConfig.overtimeRateMultiplier = String(rawOvertimeMultiplier);
      if (typeof rawOvertimeThreshold === "string" && rawOvertimeThreshold.trim()) staffConfig.overtimeThresholdHours = rawOvertimeThreshold.trim();
      if (typeof rawEmailSignature === "string") staffConfig.emailSignature = rawEmailSignature.trim() || undefined;
      if (typeof rawTimezone === "string" && rawTimezone.trim()) staffConfig.timezone = rawTimezone.trim();
      if (typeof rawLunchBreakMinutes === "number" || (typeof rawLunchBreakMinutes === "string" && rawLunchBreakMinutes.trim())) {
        const mins = typeof rawLunchBreakMinutes === "number" ? rawLunchBreakMinutes : parseInt(String(rawLunchBreakMinutes), 10);
        if (!isNaN(mins) && mins >= 0) staffConfig.lunchBreakMinutes = mins;
      }
      if (typeof rawLunchBreakPaid === "boolean") staffConfig.lunchBreakPaid = rawLunchBreakPaid;
      if (Array.isArray(rawWorkingHours) && rawWorkingHours.length > 0) {
        const hours = rawWorkingHours
          .filter((h: unknown) => h && typeof h === "object" && "dayOfWeek" in h)
          .map((h: any) => ({
            dayOfWeek: Number(h.dayOfWeek),
            isWorkingDay: Boolean(h.isWorkingDay),
            startTime: String(h.startTime ?? "07:00").slice(0, 10),
            endTime: String(h.endTime ?? "15:30").slice(0, 10),
          }));
        if (hours.length > 0) staffConfig.workingHours = hours;
      }
      const hasStaffConfig = Object.keys(staffConfig).length > 0;

      const existingInvites = await storage.listUserInvites({ status: "pending" });
      const pendingForEmail = existingInvites.find((i) => i.email === normalized);
      let invite;
      if (pendingForEmail) {
        const updated = await storage.updateUserInvite(pendingForEmail.id, {
          token,
          expiresAt,
          roleId: role ? role.id : pendingForEmail.roleId ?? null,
          firstName,
          lastName,
          profileImageUrl,
          staffConfig: hasStaffConfig ? staffConfig : undefined,
        });
        invite = updated ?? pendingForEmail;
      } else {
        invite = await storage.createUserInvite({
          email: normalized,
          token,
          invitedBy: userId,
          roleId: role ? role.id : null,
          expiresAt,
          firstName,
          lastName,
          profileImageUrl,
          permissions: validPerms.length > 0 ? validPerms : ([] as string[]),
          staffConfig: hasStaffConfig ? staffConfig : undefined,
        });
      }

      const baseUrl = process.env.BASE_URL || (req.protocol + "://" + req.get("host"));
      const acceptUrl = `${baseUrl}/accept-invite?token=${token}`;
      try {
        await sendUserInviteEmail(normalized, acceptUrl);
      } catch (e) {
        console.error("Failed to send invite email:", e);
      }

      return res.status(201).json({
        message: "Invitation sent",
        inviteId: invite.id,
        email: normalized,
        firstName: invite.firstName ?? undefined,
        lastName: invite.lastName ?? undefined,
        profileImageUrl: invite.profileImageUrl ?? undefined,
        expiresAt: invite.expiresAt.toISOString(),
        roleId: invite.roleId,
        roleName: role ? role.name : undefined,
        permissions: Array.isArray(invite.permissions) ? invite.permissions : [],
        staffConfig: invite.staffConfig ?? undefined,
      });
    } catch (err: any) {
      console.error("Error creating invite:", err);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  app.get("/api/invites", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await isSuperAdmin(req))) {
        return res.status(403).json({ message: "Only an admin can list invites" });
      }
      const status = req.query.status as string | undefined;
      const validStatus = status === "pending" || status === "used" || status === "expired" ? status : undefined;
      const invites = await storage.listUserInvites(validStatus ? { status: validStatus } : undefined);
      const allRoles = await storage.getRoles();
      const roleMap = new Map(allRoles.map((r) => [r.id, r]));
      return res.json({
        invites: invites.map((i) => ({
          id: i.id,
          email: i.email,
          firstName: i.firstName ?? null,
          lastName: i.lastName ?? null,
          profileImageUrl: i.profileImageUrl ?? null,
          roleId: i.roleId,
          roleName: i.roleId ? roleMap.get(i.roleId)?.name : undefined,
          permissions: Array.isArray(i.permissions) ? i.permissions : [],
          staffConfig: i.staffConfig ?? null,
          expiresAt: i.expiresAt,
          usedAt: i.usedAt,
          createdAt: i.createdAt,
          invitedBy: i.invitedBy,
        })),
      });
    } catch (err: any) {
      console.error("Error listing invites:", err);
      res.status(500).json({ message: "Failed to list invites" });
    }
  });

  app.post("/api/invites/accept/request-upload", async (req: any, res) => {
    try {
      const token = typeof req.body.token === "string" ? req.body.token.trim() : "";
      if (!token) {
        return res.status(400).json({ message: "Invalid or expired invite link" });
      }
      const invite = await storage.getUserInviteByToken(token);
      if (!invite || invite.usedAt || new Date() > invite.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired invite link" });
      }
      const body = req.body as Record<string, unknown>;
      const filename = (body.filename ?? body.name) as string | undefined;
      const contentType = (body.contentType ?? body.content_type) as string | undefined;
      const size = typeof body.size === "number" ? body.size : Number(body.size);
      if (!filename || typeof filename !== "string" || filename.length > 255) {
        return res.status(400).json({ error: "Missing or invalid filename" });
      }
      if (!contentType || !PROFILE_IMAGE_TYPES.includes(contentType as any)) {
        return res.status(400).json({ error: "Invalid file type. Use JPEG, PNG, or WebP." });
      }
      const sz = Number.isNaN(size) ? 0 : size;
      if (sz <= 0 || sz > PROFILE_IMAGE_MAX_BYTES) {
        return res.status(400).json({ error: "File size must be between 1 byte and 5MB" });
      }
      if (isR2Configured()) {
        const result = await generatePresignedUploadUrl({ filename, contentType, size: sz });
        if (!result) {
          return res.status(503).json({ error: "Failed to generate upload URL" });
        }
        return res.json({
          uploadURL: result.uploadUrl,
          uploadUrl: result.uploadUrl,
          objectPath: result.objectPath,
        });
      }
      const fallback = await getReplitFallbackUploadUrl();
      if (!fallback) {
        return res.status(503).json({
          error: "Storage not configured. Set R2_* env vars or use Replit object storage.",
        });
      }
      return res.json({
        uploadURL: fallback.uploadURL,
        uploadUrl: fallback.uploadURL,
        objectPath: fallback.objectPath,
      });
    } catch (err: any) {
      console.error("Error requesting profile upload URL:", err);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.get("/api/invites/accept", async (req: any, res) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
      if (!token) {
        return res.status(400).json({ message: "Invalid or expired invite link", valid: false });
      }
      const invite = await storage.getUserInviteByToken(token);
      if (!invite) {
        return res.status(400).json({ message: "Invalid or expired invite link", valid: false });
      }
      if (invite.usedAt) {
        return res.status(400).json({ message: "Invalid or expired invite link", valid: false });
      }
      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired invite link", valid: false });
      }
      return res.json({
        email: invite.email,
        valid: true,
        inviteId: invite.id,
        firstName: invite.firstName ?? undefined,
        lastName: invite.lastName ?? undefined,
      });
    } catch (err: any) {
      console.error("Error validating invite:", err);
      res.status(500).json({ message: "Invalid or expired invite link", valid: false });
    }
  });

  app.post("/api/invites/accept", async (req: any, res) => {
    try {
      const { token, password } = req.body;
      const t = typeof token === "string" ? token.trim() : "";
      if (!t) {
        return res.status(400).json({ message: "Invalid or expired invite link" });
      }
      if (!password || typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const invite = await storage.getUserInviteByToken(t);
      if (!invite) {
        return res.status(400).json({ message: "Invalid or expired invite link" });
      }
      if (invite.usedAt) {
        return res.status(400).json({ message: "Invalid or expired invite link" });
      }
      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired invite link" });
      }

      const existingIdentity = await storage.getAuthIdentityByIdentifier("email", invite.email);
      if (existingIdentity) {
        return res.status(400).json({ message: "Email is already registered" });
      }

      const first = (invite.firstName ?? "").trim().slice(0, 100) || null;
      const last = (invite.lastName ?? "").trim().slice(0, 100) || null;
      const profileUrl = (invite.profileImageUrl ?? "").trim() || null;

      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 12);
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      await authStorage.upsertUser({
        id: newUserId,
        email: invite.email,
        firstName: first,
        lastName: last,
        profileImageUrl: profileUrl,
      });
      await storage.createAuthIdentity({
        userId: newUserId,
        type: "email",
        identifier: invite.email,
        passwordHash,
        isVerified: true,
        isPrimary: true,
      });

      const sc = (invite as any).staffConfig as Record<string, unknown> | null | undefined;
      const staffRoles = Array.isArray(sc?.roles) ? (sc.roles as string[]).filter((r) => typeof r === "string") : [];
      const role = invite.roleId ? await storage.getRole(invite.roleId) : undefined;
      const finalRoles = staffRoles.length > 0 ? staffRoles : role ? [role.name] : [];

      let rolePerms: UserPermission[] = [];
      for (const rn of finalRoles) {
        const r = await storage.getRoleByName(rn);
        if (r) {
          const perms = await storage.getRolePermissions(r.id);
          rolePerms = rolePerms.concat(perms);
        }
      }
      if (rolePerms.length === 0 && role) {
        rolePerms = await storage.getRolePermissions(role.id);
      }
      const invitePermsRaw = Array.isArray(invite.permissions) ? invite.permissions : [];
      const invitePerms = invitePermsRaw.filter((p: string) =>
        userPermissions.includes(p as UserPermission)
      ) as UserPermission[];
      const merged: UserPermission[] = Array.from(new Set([...rolePerms, ...invitePerms]));
      const hasStaffConfig = sc && typeof sc === "object" && Object.keys(sc).length > 0;

      if (finalRoles.length > 0 || merged.length > 0 || hasStaffConfig) {
        const profileData: Record<string, unknown> = {
          userId: newUserId,
          roles: finalRoles,
          permissions: merged,
        };
        if (employmentTypes.includes(sc?.employmentType as any)) profileData.employmentType = sc.employmentType;
        if (sc?.salaryType === "hourly" || sc?.salaryType === "annual") profileData.salaryType = sc.salaryType;
        if (sc?.salaryAmount != null) profileData.salaryAmount = String(sc.salaryAmount);
        if (sc?.overtimeRateMultiplier != null) profileData.overtimeRateMultiplier = String(sc.overtimeRateMultiplier);
        if (sc?.overtimeThresholdHours != null) profileData.overtimeThresholdHours = String(sc.overtimeThresholdHours);
        if (sc?.emailSignature != null) profileData.emailSignature = String(sc.emailSignature);
        if (sc?.timezone != null) profileData.timezone = String(sc.timezone);
        if (typeof sc?.lunchBreakMinutes === "number" || (typeof sc?.lunchBreakMinutes === "string" && sc.lunchBreakMinutes)) {
          profileData.lunchBreakMinutes = typeof sc.lunchBreakMinutes === "number" ? sc.lunchBreakMinutes : parseInt(String(sc.lunchBreakMinutes), 10) || 30;
        }
        if (typeof sc?.lunchBreakPaid === "boolean") profileData.lunchBreakPaid = sc.lunchBreakPaid;

        const created = await storage.createStaffProfile(profileData as any);

        const wh = sc?.workingHours;
        if (created && Array.isArray(wh) && wh.length > 0) {
          const hours = wh
            .filter((h: unknown) => h && typeof h === "object" && "dayOfWeek" in h)
            .map((h: any) => ({
              dayOfWeek: Number(h.dayOfWeek),
              isWorkingDay: Boolean(h.isWorkingDay),
              startTime: String(h.startTime ?? "07:00").slice(0, 10),
              endTime: String(h.endTime ?? "15:30").slice(0, 10),
            }));
          if (hours.length > 0) {
            await storage.setStaffWorkingHours(created.id, hours);
          }
        }
      }

      await storage.markUserInviteUsed(invite.id);

      return res.status(201).json({
        message: "Account created. You can now sign in.",
        userId: newUserId,
      });
    } catch (err: any) {
      console.error("Error accepting invite:", err);
      res.status(500).json({ message: "Failed to create account" });
    }
  });
}
