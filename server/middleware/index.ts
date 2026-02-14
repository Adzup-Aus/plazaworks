import type { RequestHandler } from "express";
import { getUserId as getUserIdFromAuth, requireUserId as requireUserIdFromAuth } from "../auth-utils";
import { storage } from "../storage";
import { authStorage } from "../replit_integrations/auth";

export { getUserIdFromAuth as getUserId, requireUserIdFromAuth as requireUserId };

export const tierFeatures: Record<string, string[]> = {
  starter: ["jobs", "schedule", "basic_reports"],
  professional: ["jobs", "schedule", "basic_reports", "quotes", "invoices", "time_tracking", "vehicles", "checklists"],
  scale: ["jobs", "schedule", "basic_reports", "quotes", "invoices", "time_tracking", "vehicles", "checklists", "kpi", "capacity", "backcosting", "analytics", "custom_integrations"],
};

export const tierLimits: Record<string, { maxUsers: number; maxJobs: number }> = {
  starter: { maxUsers: 3, maxJobs: 50 },
  professional: { maxUsers: 15, maxJobs: 500 },
  scale: { maxUsers: -1, maxJobs: -1 },
};

export const requireFeature = (feature: string): RequestHandler => {
  return async (req: any, res, next) => {
    try {
      const userId = getUserIdFromAuth(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const memberships = await storage.getUserMemberships(userId);
      if (memberships.length === 0) {
        return res.status(403).json({ message: "Not a member of any organization" });
      }

      const membership = memberships.find((m) => m.isActive) || memberships[0];
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
          message: "This feature requires a higher subscription tier",
          feature,
          currentTier: subscription.tier,
          requiredTiers: Object.entries(tierFeatures)
            .filter(([, features]) => features.includes(feature))
            .map(([tier]) => tier),
        });
      }

      req.organizationId = membership.organizationId;
      req.organizationRole = membership.role;
      req.subscription = subscription;

      next();
    } catch (err) {
      console.error("Error checking feature access:", err);
      res.status(500).json({ message: "Failed to check feature access" });
    }
  };
};

export const checkUserLimit: RequestHandler = async (req: any, res, next) => {
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
    if (limits.maxUsers === -1) return next();

    const members = await storage.getOrganizationMembers(organizationId);
    const activeMembers = members.filter((m) => m.isActive);

    if (activeMembers.length >= limits.maxUsers) {
      return res.status(403).json({
        message: "User limit reached. Upgrade your plan to add more team members.",
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

export const checkJobLimit: RequestHandler = async (req: any, res, next) => {
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
    if (limits.maxJobs === -1) return next();

    const jobs = await storage.getJobs();
    const orgJobs = jobs.filter((j: any) => j.organizationId === organizationId);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyJobs = orgJobs.filter((j: any) => new Date(j.createdAt) >= startOfMonth);

    if (monthlyJobs.length >= limits.maxJobs) {
      return res.status(403).json({
        message: "Monthly job limit reached. Upgrade your plan to create more jobs.",
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

export const withOrganization: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) return next();

    let memberships = await storage.getUserMemberships(userId);

    if (memberships.length === 0) {
      const dbUser = await authStorage.getUser(userId);
      const firstName = dbUser?.firstName || "";
      const lastName = dbUser?.lastName || "";
      const orgName =
        firstName && lastName ? `${firstName} ${lastName}'s Organization` : `Organization ${userId.substring(0, 8)}`;

      const newOrg = await storage.createOrganization({
        name: orgName,
        slug: `org-${userId.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 8)}-${Date.now()}`,
        isOwner: false,
      });

      await storage.createOrganizationMember({
        organizationId: newOrg.id,
        userId,
        role: "owner",
        isActive: true,
      });

      await storage.createOrganizationSubscription({
        organizationId: newOrg.id,
        tier: "starter",
        status: "active",
        features: [],
      });

      memberships = await storage.getUserMemberships(userId);
      console.log(`Auto-created organization "${orgName}" for user ${userId}`);
    }

    if (memberships.length > 0) {
      const membership = memberships.find((m) => m.isActive) || memberships[0];
      req.organizationId = membership.organizationId;
      req.organizationRole = membership.role;
      req.subscription = await storage.getOrganizationSubscription(membership.organizationId);
    }

    next();
  } catch (err) {
    console.error("Error getting organization context:", err);
    next();
  }
};

export const requireSuperAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
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
