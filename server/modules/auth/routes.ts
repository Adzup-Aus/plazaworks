import type { Express } from "express";
import {
  storage,
  isAuthenticated,
  getUserId,
  authStorage,
  generateOTPCode,
} from "../../routes/shared";

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

      const memberships = await storage.getUserMemberships(identity.userId);

      res.json({
        message: "Login successful",
        userId: identity.userId,
        memberships: memberships.map((m) => ({
          organizationId: m.organizationId,
          role: m.role,
        })),
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
        const memberships = await storage.getUserMemberships(userId);
        const identities = await storage.getAuthIdentities(userId);

        return res.json({
          isAuthenticated: true,
          authType: req.session.authType,
          userId,
          memberships,
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

      const existing = await storage.getAuthIdentityByIdentifier("email", email.toLowerCase());
      if (existing) {
        return res.status(400).json({ message: "Email is already registered" });
      }

      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 12);

      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await storage.createAuthIdentity({
        userId: newUserId,
        type: "email",
        identifier: email.toLowerCase(),
        passwordHash,
        isVerified: false,
        isPrimary: true,
      });

      await authStorage.upsertUser({
        id: newUserId,
        email: email.toLowerCase(),
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      });

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

      const memberships = await storage.getUserMemberships(identity.userId);

      res.json({
        message: "Login successful",
        userId: identity.userId,
        isVerified: identity.isVerified,
        memberships: memberships.map((m) => ({
          organizationId: m.organizationId,
          role: m.role,
        })),
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

      const memberships = await storage.getUserMemberships(userId);
      const orgsWithOwner = await Promise.all(
        memberships.map(async (m) => {
          const org = await storage.getOrganization(m.organizationId);
          return { membership: m, org };
        })
      );

      const isSuperAdmin = orgsWithOwner.some(
        ({ membership, org }) =>
          org?.isOwner && (membership.role === "owner" || membership.role === "admin")
      );

      res.json({ isSuperAdmin });
    } catch (err) {
      console.error("Error checking super-admin:", err);
      res.json({ isSuperAdmin: false });
    }
  });
}
