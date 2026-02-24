import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { storage } from "../../storage";
import { getEffectivePermissions } from "../../middleware/permissions";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user (with role/permissions from staff profile)
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      let user = await authStorage.getUser(userId);
      // Session-based logins (email/OTP) may not have a users row yet; create minimal one
      if (!user) {
        user = await authStorage.upsertUser({ id: userId });
      }
      const profile = await storage.getStaffProfileByUserId(userId);
      const role = profile?.roles?.[0] ?? null;
      const permissions = getEffectivePermissions(profile);
      res.json({ ...user, role, permissions });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout (POST for API calls)
  app.post("/api/auth/logout", (req: any, res) => {
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

  // Logout (GET for backward compat / direct browser navigation)
  app.get("/api/logout", (req: any, res) => {
    if (req.session) {
      req.session.destroy(() => {
        res.redirect("/login");
      });
    } else {
      res.redirect("/login");
    }
  });
}
