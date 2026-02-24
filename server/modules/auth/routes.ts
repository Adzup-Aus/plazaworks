import type { Express } from "express";
import crypto from "crypto";
import {
  storage,
  isAuthenticated,
  getUserId,
  authStorage,
  generateOTPCode,
} from "../../routes/shared";
import { sendOtpEmail, sendUserInviteEmail } from "../../email";

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
          await sendOtpEmail(email, code);
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

      const { email } = req.body;
      const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!normalized || !emailRegex.test(normalized)) {
        return res.status(400).json({ message: "Invalid email" });
      }

      const existingIdentity = await storage.getAuthIdentityByIdentifier("email", normalized);
      if (existingIdentity) {
        return res.status(400).json({ message: "Email is already registered" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const existingInvites = await storage.listUserInvites({ status: "pending" });
      const pendingForEmail = existingInvites.find((i) => i.email === normalized);
      let invite;
      if (pendingForEmail) {
        const updated = await storage.updateUserInvite(pendingForEmail.id, { token, expiresAt });
        invite = updated ?? pendingForEmail;
      } else {
        invite = await storage.createUserInvite({
          email: normalized,
          token,
          invitedBy: userId,
          expiresAt,
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
        expiresAt: invite.expiresAt.toISOString(),
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
      return res.json({
        invites: invites.map((i) => ({
          id: i.id,
          email: i.email,
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
      return res.json({ email: invite.email, valid: true, inviteId: invite.id });
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

      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 12);
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      await authStorage.upsertUser({
        id: newUserId,
        email: invite.email,
      });
      await storage.createAuthIdentity({
        userId: newUserId,
        type: "email",
        identifier: invite.email,
        passwordHash,
        isVerified: true,
        isPrimary: true,
      });
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
